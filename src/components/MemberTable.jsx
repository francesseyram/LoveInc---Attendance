import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
export default function MemberTable({ members = [], loading = false }) {
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const navigate = useNavigate()

  const filtered = members.filter(m => {
    const term = search.toLowerCase()
    const matchesSearch =
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(term) ||
      (m.studentId || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term)
    const matchesRole = roleFilter === 'all' || m.role === roleFilter
    return matchesSearch && matchesRole
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All roles</option>
          <option value="member">Member</option>
          <option value="leader">Leader</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Super Admin</option>
        </select>
        <span className="text-brand-muted text-sm ml-auto whitespace-nowrap">
          {filtered.length} <span className="text-brand-subtle">members</span>
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
                <th>Student ID</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Joined</th>
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
                  <td className="font-mono text-xs text-brand-muted">{m.studentId || '—'}</td>
                  <td>
                    <span className={ROLE_BADGE[m.role] || ROLE_BADGE.member}>
                      {m.role || 'member'}
                    </span>
                  </td>
                  <td className="text-brand-muted text-sm">{m.phone || '—'}</td>
                  <td className="text-brand-muted text-xs">{formatDate(m.joinedDate)}</td>
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
