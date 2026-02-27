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
 *   service        - service object from Firestore
 *   attendanceCount - number of check-ins
 *   newMembersCount - number of first-timers
 *   onViewQR        - callback to open QR modal
 *   onSetActive     - callback to make this service active
 */
export default function ServiceCard({ service, attendanceCount = 0, newMembersCount = 0, onViewQR, onSetActive }) {
  const icon = SERVICE_TYPE_ICONS[service.type] || '📋'

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200 overflow-hidden
        ${service.isActive
          ? 'border-gold/40 bg-gold/5 shadow-gold'
          : 'border-brand-border bg-surface hover:border-brand-muted/40'
        }
      `}
    >
      {/* Active badge */}
      {service.isActive && (
        <div className="absolute top-3 right-3">
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
        {/* Type + Icon */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{icon}</span>
          <span className="text-brand-subtle text-xs font-semibold uppercase tracking-wider">{service.type}</span>
        </div>

        {/* Name */}
        <h3 className="font-display text-xl font-semibold text-brand-text mb-1">{service.name}</h3>
        <p className="text-brand-muted text-sm">{formatDate(service.date)}</p>
        {service.time && <p className="text-brand-subtle text-xs mt-0.5">{service.time}</p>}

        {/* Stats */}
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

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onViewQR?.(service)}
            className="btn-gold flex-1 text-sm py-2"
          >
            View QR
          </button>
          {!service.isActive && (
            <button
              onClick={() => onSetActive?.(service.id)}
              className="btn-ghost flex-1 text-sm py-2"
            >
              Set Active
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
