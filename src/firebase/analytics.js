import { collection, getDocs } from 'firebase/firestore'
import { db } from './config'

/**
 * Attendance analysis for the admin Stats tab.
 *
 * Everything here is computed in JS from three full-collection reads rather than
 * with Firestore aggregations — same reasoning as attendance.js: it keeps the app
 * free of composite indexes, and these collections are small (hundreds of docs).
 */

/**
 * Fallback only — the real value lives in Firestore at `config/app`
 * (inactiveAfterMissedServices) so leads can tune it without a redeploy.
 * This constant exists so analytics still works if that read fails.
 */
export const DEFAULT_INACTIVE_AFTER_MISSED_SERVICES = 3

/** Plain-English version of the rule, so the UI and the logic can't drift apart. */
export function activityRuleLabel(n) {
  return `Inactive = no check-in in the last ${n} service${n === 1 ? '' : 's'}`
}

/** One-shot read of every attendance record. Admin-only — the public page never calls this. */
export async function getAllAttendance() {
  const snap = await getDocs(collection(db, 'attendance'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

const seconds = (ts) => ts?.seconds ?? 0

/** Services that have actually happened, oldest first. Future/undated ones are excluded. */
export function heldServices(services) {
  const today = new Date().toISOString().slice(0, 10)
  return services
    .filter(s => (s.date && s.date <= today) || s.isCompleted)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || seconds(a.createdAt) - seconds(b.createdAt))
}

/**
 * The whole analysis in one pass.
 * Returns per-service trend rows, per-member activity, and fellowship-level totals.
 */
export function buildAnalytics({
  members = [], services = [], attendance = [],
  inactiveAfterMissedServices = DEFAULT_INACTIVE_AFTER_MISSED_SERVICES,
} = {}) {
  const windowSize = Number.isFinite(inactiveAfterMissedServices) && inactiveAfterMissedServices > 0
    ? inactiveAfterMissedServices
    : DEFAULT_INACTIVE_AFTER_MISSED_SERVICES
  const held = heldServices(services)
  const heldIds = new Set(held.map(s => s.id))
  const attendees = members.filter(m => !String(m.studentId || '').startsWith('auth-'))

  // ─── group attendance by service and by member ──────────────
  const byService = new Map()
  const byMember = new Map()
  for (const a of attendance) {
    if (!heldIds.has(a.serviceId)) continue
    if (!byService.has(a.serviceId)) byService.set(a.serviceId, [])
    byService.get(a.serviceId).push(a)
    if (!byMember.has(a.memberId)) byMember.set(a.memberId, [])
    byMember.get(a.memberId).push(a)
  }

  // ─── trend: one row per service, oldest first ───────────────
  const trend = held.map(s => {
    const recs = byService.get(s.id) || []
    const newcomers = recs.filter(r => r.isNew).length
    return {
      id: s.id,
      name: s.name || 'Untitled',
      date: s.date || '',
      type: s.type || '',
      total: recs.length,
      newcomers,
      returning: recs.length - newcomers,
      rate: attendees.length ? Math.round((recs.length / attendees.length) * 100) : 0,
    }
  })

  // ─── the recent window that defines active vs inactive ──────
  const recentWindow = held.slice(-windowSize)
  const recentIds = new Set(recentWindow.map(s => s.id))

  const serviceById = new Map(held.map(s => [s.id, s]))
  const memberRows = attendees.map(m => {
    const recs = (byMember.get(m.id) || []).slice().sort((a, b) => seconds(b.checkedInAt) - seconds(a.checkedInAt))
    const last = recs[0]
    const lastService = last ? serviceById.get(last.serviceId) : null
    const inWindow = recs.filter(r => recentIds.has(r.serviceId)).length
    return {
      ...m,
      timesAttended: recs.length,
      lastSeenAt: last?.checkedInAt || null,
      lastSeenService: lastService?.name || '',
      lastSeenDate: lastService?.date || '',
      attendedInWindow: inWindow,
      isActive: inWindow > 0,
      // share of held services they've been to — the simplest honest rate
      rate: held.length ? Math.round((recs.length / held.length) * 100) : 0,
    }
  })

  const active = memberRows.filter(m => m.isActive)
  const inactive = memberRows.filter(m => !m.isActive)
  const neverAttended = memberRows.filter(m => m.timesAttended === 0)

  // Regulars: made most of the recent window. Drops: used to come, now absent.
  const regulars = memberRows.filter(
    m => recentWindow.length > 0 && m.attendedInWindow === recentWindow.length,
  )
  const drops = inactive
    .filter(m => m.timesAttended >= 2)
    .sort((a, b) => seconds(b.lastSeenAt) - seconds(a.lastSeenAt))

  // Do first-timers come back? Anyone whose first check-in was flagged isNew.
  const firstTimers = memberRows.filter(m => (byMember.get(m.id) || []).some(r => r.isNew))
  const stuckAround = firstTimers.filter(m => m.timesAttended >= 2)

  const totalCheckIns = trend.reduce((n, t) => n + t.total, 0)

  return {
    trend,
    memberRows,
    recentWindow,
    inactiveAfterMissedServices: windowSize,
    activityRule: activityRuleLabel(windowSize),
    totals: {
      members: attendees.length,
      servicesHeld: held.length,
      totalCheckIns,
      avgPerService: held.length ? Math.round(totalCheckIns / held.length) : 0,
      active: active.length,
      inactive: inactive.length,
      neverAttended: neverAttended.length,
      regulars: regulars.length,
      firstTimers: firstTimers.length,
      stuckAround: stuckAround.length,
      retentionRate: firstTimers.length
        ? Math.round((stuckAround.length / firstTimers.length) * 100)
        : 0,
      activeRate: attendees.length ? Math.round((active.length / attendees.length) * 100) : 0,
    },
    lists: { active, inactive, neverAttended, regulars, drops },
  }
}

/** 'Never' / '3 Feb' — for member tables and profiles. */
export function formatLastSeen(row) {
  if (!row?.lastSeenAt?.seconds) return 'Never'
  return new Date(row.lastSeenAt.seconds * 1000)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
