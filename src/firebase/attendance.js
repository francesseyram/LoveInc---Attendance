import {
  collection,
  doc,
  runTransaction,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './config'

const ATTENDANCE = 'attendance'

/**
 * Check if a member has already checked in for a service.
 */
export async function hasCheckedIn(memberId, serviceId) {
  const q = query(
    collection(db, ATTENDANCE),
    where('memberId',  '==', memberId),
    where('serviceId', '==', serviceId)
  )
  const snap = await getDocs(q)
  return !snap.empty
}

/**
 * Attendance is one row per (member, service), so the document ID *is* that pair.
 *
 * With a random `addDoc` id there was nothing stopping two writes for the same
 * pair: the old flow read `hasCheckedIn()` and then wrote, and anyone who
 * double-tapped — or tapped again on a slow connection — landed two rows and
 * inflated the count. A load test with five simultaneous taps produced five
 * rows. A deterministic id makes that impossible.
 */
export function attendanceId(memberId, serviceId) {
  return `${serviceId}__${memberId}`
}

/**
 * Log a check-in, idempotently. Returns { id, alreadyCheckedIn }.
 *
 * The transaction means concurrent taps collapse into one row and the first
 * check-in time is the one kept, rather than being overwritten by the retry.
 */
export async function checkIn(memberId, serviceId, isNew = false) {
  const ref = doc(db, ATTENDANCE, attendanceId(memberId, serviceId))
  const alreadyCheckedIn = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref)
    if (existing.exists()) return true
    tx.set(ref, { memberId, serviceId, checkedInAt: serverTimestamp(), isNew })
    return false
  })
  return { id: ref.id, alreadyCheckedIn }
}

/**
 * Get all attendance records for a specific service (one-shot).
 * Sorts client-side to avoid needing a Firestore composite index.
 */
export async function getAttendanceForService(serviceId) {
  const q = query(collection(db, ATTENDANCE), where('serviceId', '==', serviceId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.checkedInAt?.seconds ?? 0) - (b.checkedInAt?.seconds ?? 0))
}

/**
 * Get all attendance records for a specific member (their history).
 * Sorts client-side — newest first.
 */
export async function getAttendanceForMember(memberId) {
  const q = query(collection(db, ATTENDANCE), where('memberId', '==', memberId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.checkedInAt?.seconds ?? 0) - (a.checkedInAt?.seconds ?? 0))
}

/**
 * Real-time subscription to attendance for a service.
 * Uses only a `where` clause (no orderBy) to avoid needing a Firestore composite index.
 * Sorts results client-side so they're always in check-in order.
 * Returns the unsubscribe function.
 */
export function subscribeToServiceAttendance(serviceId, callback) {
  const q = query(
    collection(db, ATTENDANCE),
    where('serviceId', '==', serviceId)
  )

  return onSnapshot(q, (snap) => {
    const records = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.checkedInAt?.seconds ?? 0) - (b.checkedInAt?.seconds ?? 0))
    callback(records)
  }, (error) => {
    console.error('Attendance subscription error:', error)
  })
}

/**
 * Get the check-in count for a service (one-shot).
 */
export async function getServiceAttendanceCount(serviceId) {
  const q = query(collection(db, ATTENDANCE), where('serviceId', '==', serviceId))
  const snap = await getDocs(q)
  return snap.size
}
