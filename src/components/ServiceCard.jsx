import { useState, useEffect } from 'react'

const SERVICE_TYPE_ICONS = {
  'Sunday Service': '⛪',
  'Midweek':        '📖',
  'Special':        '✨',
  'Prayer':         '🙏',
  'Bible Study':    '📚',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Props:
 *   service, attendanceCount, newMembersCount
 *   onViewQR, onEditFlier, onSetActive, onComplete, onDelete
 *   isSuperAdmin — show delete flow
 */
export default function ServiceCard({
  service,
  attendanceCount = 0,
  newMembersCount = 0,
  onViewQR,
  onEditFlier,
  onSetActive,
  onComplete,
  onDelete,
  isSuperAdmin = false,
}) {
  const icon = SERVICE_TYPE_ICONS[service.type] || ''
  const isCompleted = service.isCompleted === true
  const isActive = service.isActive === true && !isCompleted

  const [deletePanel, setDeletePanel] = useState(false)

  useEffect(() => {
    setDeletePanel(false)
  }, [service.id])

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200 overflow-hidden
        ${isActive
          ? 'border-gold/40 bg-gold/5 shadow-gold'
          : 'border-brand-border bg-surface hover:border-brand-muted/40'
        }
      `}
    >
      {/* Status badges */}
      {isCompleted && (
        <div className="absolute top-3 right-3 z-10">
          <span className="badge bg-surface-elevated text-brand-muted border border-brand-border flex items-center gap-1">
            ✓ Completed
          </span>
        </div>
      )}
      {isActive && (
        <div className="absolute top-3 right-3 z-10">
          <span className="badge-green flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            Active
          </span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{icon}</span>
          <span className="text-brand-subtle text-xs font-semibold uppercase tracking-wider">{service.type}</span>
        </div>

        <h3 className="font-display text-xl font-semibold text-brand-text mb-1 pr-24">{service.name}</h3>
        <p className="text-brand-muted text-sm">{formatDate(service.date)}</p>
        {service.time && <p className="text-brand-subtle text-xs mt-0.5">{service.time}</p>}

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-brand-border">
          <div className="text-center">
            <p className="font-display text-2xl font-semibold text-brand-text">{attendanceCount}</p>
            <p className="text-brand-subtle text-xs">Attended</p>
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-semibold text-gold">{newMembersCount}</p>
            <p className="text-brand-subtle text-xs">First Timers</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => onViewQR?.(service)}
            className="btn-gold flex-1 min-w-[120px] text-sm py-2"
          >
            View QR
          </button>
          {!isActive && !isCompleted && (
            <button
              type="button"
              onClick={() => onSetActive?.(service.id)}
              className="btn-ghost flex-1 min-w-[120px] text-sm py-2"
            >
              Set Active
            </button>
          )}
          <button
            type="button"
            onClick={() => onEditFlier?.(service)}
            className="flex-1 min-w-[140px] btn-ghost text-sm py-2"
          >
            Flier
          </button>
          {isActive && (
            <button
              type="button"
              onClick={() => onComplete?.(service.id)}
              className="flex-1 min-w-[140px] text-sm py-2 rounded-lg border border-green-600/50 bg-green-900/20 text-green-400 hover:bg-green-900/30 transition-colors"
            >
              ✓ Mark as Completed
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <div className="mt-4 pt-4 border-t border-brand-border">
            {!deletePanel ? (
              <button
                type="button"
                onClick={() => setDeletePanel(true)}
                className="text-sm text-red-400/90 hover:text-red-300 underline-offset-2 hover:underline"
              >
                Delete service
              </button>
            ) : (
              <div className="rounded-lg bg-red-900/15 border border-red-800/50 p-3 space-y-3">
                <p className="text-brand-text text-sm">
                  Delete <span className="font-semibold text-brand-text">&quot;{service.name}&quot;</span>? This cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletePanel(false)}
                    className="btn-ghost text-sm py-2 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete?.(service.id)
                      setDeletePanel(false)
                    }}
                    className="text-sm py-2 px-3 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium"
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
