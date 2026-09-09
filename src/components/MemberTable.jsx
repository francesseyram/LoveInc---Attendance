import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatStudentIdForDisplay } from '../firebase/members'
import { formatLastSeen } from '../firebase/analytics'

const ROLE_BADGE = {
  superadmin: 'badge-purple',
  admin:      'badge-blue',
  leader:     'badge-gold',
  member:     'badge bg-surface-elevated text-brand-muted border border-brand-border',
}

function formatDate(ts) {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Props:
 *   members - array of member objects from Firestore
 *   loading - boolean
 */
export default function MemberTable({ members = [], loading = false, classOptions = [] }) {
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [activity, setActivity] = useState('all')
  const navigate = useNavigate()

  // Every class present on a member, plus any configured in Settings that
  // nobody belongs to yet — so a new class is filterable before it has members.
  const classes = useMemo(() => {
    const present = members.map(m => m.cohort).filter(Boolean)
    return [...new Set([...present, ...classOptions])].sort().reverse()
  }, [members, classOptions])

  const withoutClass = useMemo(() => members.filter(m => !m.cohort).length, [members])

  const filtered = members.filter(m => {
    const term = search.toLowerCase()
    const matchesSearch =
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(term) ||
      (m.studentId || '').toLowerCase().includes(term) ||
      (m.cohort    || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term)
    const matchesRole = roleFilter === 'all' || m.role === roleFilter
    const matchesClass =
      classFilter === 'all' ? true
      : classFilter === '__none' ? !m.cohort
      : m.cohort === classFilter
    // isActive only exists once analytics has run; treat undefined as unknown.
    const matchesActivity =
      activity === 'all' ? true
      : activity === 'active' ? m.isActive === true
      : activity === 'inactive' ? m.isActive === false
      : m.timesAttended === 0
    return matchesSearch && matchesRole && matchesClass && matchesActivity
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="input w-auto">
          <option value="all">All classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
          {withoutClass > 0 && <option value="__none">No class ({withoutClass})</option>}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input w-auto">
          <option value="all">All roles</option>
          <option value="member">Member</option>
          <option value="leader">Leader</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Super Admin</option>
        </select>
        <select value={activity} onChange={e => setActivity(e.target.value)} className="input w-auto">
          <option value="all">Any activity</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="never">Never attended</option>
        </select>
        {(classFilter !== 'all' || roleFilter !== 'all' || activity !== 'all' || search) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setRoleFilter('all'); setClassFilter('all'); setActivity('all') }}
            className="btn-ghost whitespace-nowrap"
          >
            Clear
          </button>
        )}
        <span className="text-brand-muted text-sm ml-auto whitespace-nowrap tabular">
          {filtered.length}<span className="text-brand-subtle"> of {members.length}</span>
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-muted">
          {members.length === 0 ? 'No members yet.' : 'No results match your search.'}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Cohort</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold text-xs font-semibold">
                          {(m.firstName?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-brand-text text-sm">{m.firstName} {m.lastName}</p>
                        <p className="text-brand-subtle text-xs">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-brand-muted">{formatStudentIdForDisplay(m.studentId)}</td>
                  <td>
                    <span className={ROLE_BADGE[m.role] || ROLE_BADGE.member}>
                      {m.role || 'member'}
                    </span>
                  </td>
                  <td className="text-brand-muted text-sm">{m.cohort || '—'}</td>
                  <td className="text-xs">
                    {m.lastSeenAt
                      ? <span className="text-brand-muted">{formatLastSeen(m)}</span>
                      : <span className="text-brand-subtle">Never</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => navigate(`/admin/members/${m.id}`)}
                      className="text-gold text-xs hover:text-gold-light transition-colors duration-150 font-medium"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
