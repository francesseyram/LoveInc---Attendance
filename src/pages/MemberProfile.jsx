import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../App'
import {
  getMemberById,
  updateMemberRole,
  formatStudentIdForDisplay,
  validateRoleAssignment,
  ROLES_ASSIGNABLE_BY_ADMIN,
  ROLES_ASSIGNABLE_BY_SUPERADMIN,
} from '../firebase/members'
import { getAttendanceForMember }           from '../firebase/attendance'
import { getServiceById }                   from '../firebase/services'

function roleOptionLabel(r) {
  if (r === 'superadmin') return 'Super Admin'
  return r.charAt(0).toUpperCase() + r.slice(1)
}

const ROLE_BADGE = {
  superadmin: 'badge-purple',
  admin:      'badge-blue',
  leader:     'badge-gold',
  member:     'badge bg-surface-elevated text-brand-muted border border-brand-border',
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MemberProfile() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { memberRole } = useAuth()

  const [member,    setMember]    = useState(null)
  const [history,   setHistory]   = useState([])  // { attendance, service }[]
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [newRole,   setNewRole]   = useState('')
  const [roleSaved, setRoleSaved] = useState(false)
  const [error,     setError]     = useState('')
  const [roleError, setRoleError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [m, attendance] = await Promise.all([
          getMemberById(id),
          getAttendanceForMember(id),
        ])

        if (!m) { setError('Member not found.'); setLoading(false); return }
        setMember(m)
        setNewRole(m.role)
        setRoleError('')

        // Fetch service details for each attendance record
        const withServices = await Promise.all(
          attendance.map(async (a) => {
            const svc = await getServiceById(a.serviceId).catch(() => null)
            return { attendance: a, service: svc }
          })
        )
        setHistory(withServices)
      } catch (err) {
        console.error(err)
        setError('Failed to load member profile.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleRoleUpdate = async () => {
    if (!member || newRole === member.role) return
    setRoleError('')
    const denied = validateRoleAssignment(memberRole, member.role, newRole)
    if (denied) {
      setRoleError(denied)
      return
    }
    setSaving(true)
    try {
      await updateMemberRole(id, newRole)
      setMember(m => ({ ...m, role: newRole }))
      setRoleSaved(true)
      setTimeout(() => setRoleSaved(false), 2500)
    } catch (err) {
      console.error(err)
      setRoleError('Could not save role. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Super Admins can change anyone; regular Admins only Member ↔ Leader for non-Admin accounts (Leaders cannot assign roles)
  const actorCanManageRoles = memberRole === 'superadmin' || memberRole === 'admin'
  const canEditThisMemberRole =
    actorCanManageRoles &&
    (memberRole === 'superadmin' || (member && ['member', 'leader'].includes(member.role)))
  const assignableRoles =
    memberRole === 'superadmin' ? ROLES_ASSIGNABLE_BY_SUPERADMIN : ROLES_ASSIGNABLE_BY_ADMIN

  // Keep selected role valid if permissions / member change
  useEffect(() => {
    if (!member) return
    const editable =
      (memberRole === 'superadmin' || memberRole === 'admin') &&
      (memberRole === 'superadmin' || ['member', 'leader'].includes(member.role))
    if (!editable) return
    const allowed = memberRole === 'superadmin' ? ROLES_ASSIGNABLE_BY_SUPERADMIN : ROLES_ASSIGNABLE_BY_ADMIN
    if (!allowed.includes(newRole)) setNewRole(member.role)
  }, [member, memberRole, newRole])

  const attendanceRate = history.length > 0
    ? `${Math.round((history.length / Math.max(history.length, 1)) * 100)}%`
    : '0%'

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => navigate('/admin')}
          className="text-brand-muted hover:text-brand-text transition-colors text-sm flex items-center gap-1 mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        ) : member && (
          <div className="space-y-6 animate-slide-up">

            {/* Profile header */}
            <div className="card flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-gold/10 border-2 border-gold/30 flex items-center justify-center flex-shrink-0">
                <span className="font-display text-3xl text-gold font-semibold">
                  {(member.firstName?.[0] || '?').toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display text-3xl font-semibold text-brand-text">
                    {member.firstName} {member.lastName}
                  </h1>
                  <span className={ROLE_BADGE[member.role] || ROLE_BADGE.member}>
                    {member.role}
                  </span>
                </div>
                <p className="text-brand-muted text-sm mt-1">
                  Student ID: <span className="font-mono text-brand-text">{formatStudentIdForDisplay(member.studentId)}</span>
                </p>
                <p className="text-brand-subtle text-xs mt-0.5">
                  Joined {formatDate(member.joinedDate)} · via{' '}
                  {member.createdBy === 'auth_sync'
                    ? 'Login sync'
                    : member.createdBy === 'admin'
                      ? 'Admin'
                      : 'Check-In'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: Details */}
              <div className="lg:col-span-2 space-y-4">
                {/* Contact info */}
                <div className="card">
                  <h2 className="font-display text-xl font-semibold text-brand-text mb-4">Contact Information</h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Email',    value: member.email    || '—' },
                      { label: 'Phone',    value: member.phone    || '—' },
                      { label: 'Birthday', value: member.birthday ? new Date(member.birthday).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '—' },
                      { label: 'Student ID', value: formatStudentIdForDisplay(member.studentId) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <dt className="label mb-1">{label}</dt>
                        <dd className="text-brand-text">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Attendance History */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-semibold text-brand-text">Attendance History</h2>
                    <span className="badge-gold">{history.length} services</span>
                  </div>

                  {history.length === 0 ? (
                    <p className="text-brand-muted text-sm text-center py-6">No attendance records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map(({ attendance: a, service: s }) => (
                        <div key={a.id} className="flex items-center justify-between py-3 border-b border-brand-border last:border-0">
                          <div>
                            <p className="text-brand-text text-sm font-medium">{s?.name || 'Unknown Service'}</p>
                            <p className="text-brand-subtle text-xs">{s?.type} · {formatDateTime(a.checkedInAt)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.isNew && <span className="badge-gold">First Timer</span>}
                            <span className="badge-green">Present</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Stats + Role */}
              <div className="space-y-4">
                {/* Stats */}
                <div className="card text-center">
                  <p className="font-display text-5xl font-semibold text-gold">{history.length}</p>
                  <p className="text-brand-muted text-xs uppercase tracking-widest mt-1">Services Attended</p>
                  <div className="gold-divider my-4" />
                  <p className="font-display text-3xl font-semibold text-brand-text">
                    {history.length > 0 ? '100%' : '—'}
                  </p>
                  <p className="text-brand-muted text-xs uppercase tracking-widest mt-1">Check-In Rate</p>
                </div>

                {/* Role management */}
                <div className="card">
                  <h3 className="font-display text-lg font-semibold text-brand-text mb-4">Role Management</h3>

                  {!actorCanManageRoles ? (
                    <p className="text-brand-muted text-sm">
                      Your account doesn&apos;t have permission to change roles.
                    </p>
                  ) : !canEditThisMemberRole ? (
                    <>
                      <label className="label">Member Role</label>
                      <div className="mt-1">
                        <span className={ROLE_BADGE[member.role] || ROLE_BADGE.member}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-brand-subtle text-xs mt-3">
                        Only <strong className="text-brand-muted">Super Admins</strong> can change roles for Admin
                        or Super Admin accounts.
                      </p>
                    </>
                  ) : (
                    <>
                      <label className="label">Member Role</label>
                      <select
                        className="input mb-3"
                        value={assignableRoles.includes(newRole) ? newRole : assignableRoles[0]}
                        onChange={e => {
                          setNewRole(e.target.value)
                          setRoleError('')
                        }}
                      >
                        {assignableRoles.map(r => (
                          <option key={r} value={r}>{roleOptionLabel(r)}</option>
                        ))}
                      </select>
                      {roleError && (
                        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 mb-3">
                          {roleError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleRoleUpdate}
                        disabled={saving || newRole === member.role}
                        className="btn-gold w-full text-sm py-2"
                      >
                        {saving ? 'Saving…' : roleSaved ? '✓ Saved!' : 'Update Role'}
                      </button>
                      <p className="text-brand-subtle text-xs mt-2 text-center">
                        {memberRole === 'superadmin'
                          ? 'You can assign any role, including Admin and Super Admin.'
                          : 'You can assign Member or Leader only. Super Admins set Admin roles.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
