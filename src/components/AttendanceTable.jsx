import { useState } from 'react'

const ROLE_BADGE = {
  superadmin: 'badge-purple',
  admin:      'badge-blue',
  leader:     'badge-gold',
  member:     'badge bg-surface-elevated text-brand-muted border border-brand-border',
}

function formatTime(ts) {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * 
 * Props:
 *   records      - array of attendance objects (already joined with member data)
 *                  each: { id, memberId, firstName, lastName, studentId, role, checkedInAt, isNew }
 *   loading      - boolean
 *   canEdit      - if true, admins can undo a check-in
 *   onMarkAbsent - async callback(record) that removes the check-in
 */
export default function AttendanceTable({ records = [], loading = false, canEdit = false, onMarkAbsent }) {
  const [search,    setSearch]    = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busyId,    setBusyId]    = useState(null)

  const handleMarkAbsent = async (record) => {
    setBusyId(record.id)
    try {
      await onMarkAbsent?.(record)
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  const filtered = records.filter(r => {
    const term = search.toLowerCase()
    return (
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(term) ||
      (r.studentId || '').toLowerCase().includes(term)
    )
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
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or student ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <span className="text-brand-muted text-sm">
          {filtered.length} <span className="text-brand-subtle">checked in</span>
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-muted">
          {records.length === 0
            ? 'No check-ins yet. Share the QR code to get started.'
            : 'No results match your search.'}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Check-In Time</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={r.isNew ? 'bg-gold/5' : ''}>
                  <td className="text-brand-subtle w-10">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-gold text-xs font-semibold">
                          {(r.firstName?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-brand-text">
                        {r.firstName} {r.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="text-brand-muted font-mono text-xs">{r.studentId || '—'}</td>
                  <td>
                    <span className={ROLE_BADGE[r.role] || ROLE_BADGE.member}>
                      {r.role || 'member'}
                    </span>
                  </td>
                  <td className="text-brand-muted text-xs tabular-nums">{formatTime(r.checkedInAt)}</td>
                  <td>
                    {r.isNew ? (
                      <span className="badge-gold">First Timer</span>
                    ) : (
                      <span className="badge-green">Present</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="text-right whitespace-nowrap">
                      {confirmId === r.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="text-brand-muted hover:text-brand-text text-xs transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkAbsent(r)}
                            disabled={busyId === r.id}
                            className="text-xs py-1 px-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-60"
                          >
                            {busyId === r.id ? 'Removing…' : 'Confirm'}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(r.id)}
                          className="text-xs text-red-400/90 hover:text-red-300 font-medium transition-colors"
                          title="Undo this check-in"
                        >
                          Mark absent
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
