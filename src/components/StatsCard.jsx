/**
 * A single figure in the admin. The number is the point, so it carries the
 * display face and the label sits above it in mono, the way the fliers set
 * their detail line.
 *
 * Props:
 *   label      - string, e.g. "In Service"
 *   value      - number or string to display prominently
 *   sub        - optional context line under the value
 *   highlight  - marks the figure that matters most on the screen
 *   live       - shows a pulsing indicator for realtime counts
 */
export default function StatsCard({ label, value, sub, highlight = false, live = false }) {
  return (
    <div
      className={`relative overflow-hidden bg-surface border transition-colors duration-150
                  ${highlight ? 'border-gold/45' : 'border-brand-border hover:border-brand-muted/40'}`}
      style={{ borderRadius: 'var(--radius)' }}
    >
      {/* A rule along the top edge marks the headline figure without tinting the whole tile. */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: highlight ? 'var(--tab-active)' : 'transparent' }}
      />

      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="eyebrow">{label}</span>
          {live && (
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
              </span>
              <span className="eyebrow !text-gold">Live</span>
            </span>
          )}
        </div>

        <p className={`font-display text-[2.6rem] leading-[0.9] tabular-nums
                       ${highlight ? 'text-gold' : 'text-brand-text'}`}>
          {value ?? '—'}
        </p>

        {sub && <p className="text-brand-subtle text-xs mt-2.5">{sub}</p>}
      </div>
    </div>
  )
}
