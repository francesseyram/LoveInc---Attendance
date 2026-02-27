/**
 * A premium stats card used in the Live and Stats tabs.
 *
 * Props:
 *   label      - string, e.g. "In Service"
 *   value      - number or string to display prominently
 *   sub        - optional subtitle / context text
 *   icon       - optional emoji or symbol
 *   highlight  - if true, uses gold accent border
 *   live       - if true, shows a live indicator dot
 */
export default function StatsCard({ label, value, sub, icon, highlight = false, live = false }) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border p-5 transition-all duration-200
        ${highlight
          ? 'bg-gold/5 border-gold/30 shadow-gold-sm'
          : 'bg-surface border-brand-border hover:border-brand-muted/40'
        }
      `}
    >
      {/* Live indicator */}
      {live && (
        <span className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-500 text-xs font-medium">LIVE</span>
        </span>
      )}

      {/* Icon */}
      {icon && (
        <div className="text-2xl mb-3">{icon}</div>
      )}

      {/* Value */}
      <div className={`font-display text-4xl font-semibold leading-none mb-1 ${highlight ? 'text-gold' : 'text-brand-text'}`}>
        {value ?? '—'}
      </div>

      {/* Label */}
      <div className="text-brand-muted text-xs font-semibold uppercase tracking-widest mt-2">
        {label}
      </div>

      {/* Sub */}
      {sub && (
        <div className="text-brand-subtle text-xs mt-1">{sub}</div>
      )}
    </div>
  )
}
