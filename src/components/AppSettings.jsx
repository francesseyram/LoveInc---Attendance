import { useEffect, useState } from 'react'
import { getAppConfig, saveAppConfig, DEFAULTS } from '../firebase/settings'
import { rebuildSearchIndex } from '../firebase/members'

/**
 * Editor for `config/app` — service types, extra class options, and the rule
 * that decides who counts as inactive. These used to be literals in the
 * components; keeping them here means changing them never needs a deploy.
 *
 * Props: canEdit (admins and superadmins only)
 */
export default function AppSettings({ canEdit }) {
  const [types, setTypes]     = useState([])
  const [classes, setClasses] = useState([])
  const [inactive, setInactive] = useState(DEFAULTS.inactiveAfterMissedServices)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [note, setNote]       = useState('')
  const [error, setError]     = useState('')
  const [indexing, setIndexing] = useState(false)

  useEffect(() => {
    getAppConfig({ force: true })
      .then(c => {
        setTypes(c.serviceTypes)
        setClasses(c.classOptions || [])
        setInactive(c.inactiveAfterMissedServices)
      })
      .finally(() => setLoading(false))
  }, [])

  const setType = (i, key) => (e) =>
    setTypes(ts => ts.map((t, n) => (n === i ? { ...t, [key]: e.target.value } : t)))

  const addType    = () => setTypes(ts => [...ts, { name: '', icon: '•' }])
  const removeType = (i) => setTypes(ts => ts.filter((_, n) => n !== i))

  const setClass    = (i) => (e) => setClasses(cs => cs.map((c, n) => (n === i ? e.target.value : c)))
  const addClass    = () => setClasses(cs => [...cs, ''])
  const removeClass = (i) => setClasses(cs => cs.filter((_, n) => n !== i))

  const save = async () => {
    const cleaned = types.map(t => ({ name: t.name.trim(), icon: (t.icon || '').trim() || '•' }))
                         .filter(t => t.name)
    if (!cleaned.length) {
      setError('Keep at least one service type — the new-service form needs something to offer.')
      return
    }
    const n = Number(inactive)
    if (!Number.isFinite(n) || n < 1) {
      setError('The inactivity rule needs to be a whole number of services, at least 1.')
      return
    }

    setBusy(true); setError(''); setNote('')
    try {
      await saveAppConfig({
        serviceTypes: cleaned,
        classOptions: [...new Set(classes.map(c => c.trim()).filter(Boolean))],
        inactiveAfterMissedServices: n,
      })
      setTypes(cleaned)
      setClasses(cs => [...new Set(cs.map(c => c.trim()).filter(Boolean))])
      setNote('Saved. Reload the dashboard to see the new values applied.')
    } catch (err) {
      console.error(err)
      setError('Could not save. Check your connection and that you are still signed in.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="card text-center py-14 text-brand-muted text-sm">Loading settings…</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="eyebrow mb-2">Configuration</p>
        <h2 className="font-display text-3xl text-brand-text">Settings</h2>
        <p className="text-brand-muted mt-2 max-w-xl">
          These drive the new-service form, the check-in form, and the activity rule on Stats.
          Changes take effect without a deploy.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* Service types — the longest list, so it leads */}
        <section className="card">
          <h3 className="font-display text-xl text-brand-text mb-1">Service types</h3>
          <p className="text-brand-muted text-sm mb-5">Offered when creating a service.</p>

          <div className="space-y-2">
            {types.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input w-[4.5rem] text-center text-lg shrink-0" value={t.icon || ''}
                  onChange={setType(i, 'icon')} disabled={!canEdit} aria-label="Icon"
                />
                <input
                  className="input" value={t.name} onChange={setType(i, 'name')}
                  placeholder="Service type" disabled={!canEdit} aria-label="Type name"
                />
                {canEdit && (
                  <button
                    type="button" onClick={() => removeType(i)}
                    className="btn-ghost px-3 shrink-0" aria-label={`Remove ${t.name || 'type'}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEdit && <button type="button" onClick={addType} className="btn-ghost mt-3">Add type</button>}
        </section>

        {/* The two short settings stack beside it rather than trailing below */}
        <div className="space-y-6">
          <section className="card">
            <h3 className="font-display text-xl text-brand-text mb-1">Classes</h3>
            <p className="text-brand-muted text-sm mb-4">
              Class years found in the roster are offered automatically. Add any others here —
              new cohorts, streams like C2030 A, or Staff and Alumni.
            </p>
            <div className="space-y-2">
              {classes.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input" value={c} onChange={setClass(i)}
                    placeholder="e.g. C2030 A" disabled={!canEdit} aria-label="Class"
                  />
                  {canEdit && (
                    <button
                      type="button" onClick={() => removeClass(i)}
                      className="btn-ghost px-3 shrink-0" aria-label={`Remove ${c || 'class'}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && <button type="button" onClick={addClass} className="btn-ghost mt-3">Add class</button>}
          </section>

          <section className="card">
            <h3 className="font-display text-xl text-brand-text mb-1">Search index</h3>
            <p className="text-brand-muted text-sm mb-4">
              Check-in searches one index document instead of every member, which is what keeps
              a busy door from exhausting the daily read quota. Self-registration updates it
              automatically — rebuild after a bulk import or mass edit.
            </p>
            <button
              type="button" disabled={!canEdit || indexing} className="btn-ghost"
              onClick={async () => {
                setIndexing(true); setError(''); setNote('')
                try { setNote(`Search index rebuilt — ${await rebuildSearchIndex()} members.`) }
                catch { setError('Could not rebuild the search index.') }
                finally { setIndexing(false) }
              }}
            >
              {indexing ? 'Rebuilding…' : 'Rebuild search index'}
            </button>
          </section>

          <section className="card">
            <h3 className="font-display text-xl text-brand-text mb-1">Activity rule</h3>
            <p className="text-brand-muted text-sm mb-4">
              How many recent services someone can miss before Stats counts them inactive.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number" min="1" max="20" className="input tabular w-24 text-center text-lg"
                value={inactive} onChange={e => setInactive(e.target.value)} disabled={!canEdit}
              />
              <span className="text-brand-muted text-sm">
                missed service{Number(inactive) === 1 ? '' : 's'} → inactive
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* Action bar spans both columns so Save isn't stranded under one of them */}
      <div className="mt-8 pt-6 border-t border-brand-border flex flex-wrap items-center gap-4">
        {canEdit ? (
          <button type="button" onClick={save} disabled={busy} className="btn-gold px-7 py-3">
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        ) : (
          <p className="text-brand-muted text-sm">Only admins can change these.</p>
        )}
        {error && <p className="badge-red !rounded-md px-3 py-2">{error}</p>}
        {note  && <p className="badge-green !rounded-md px-3 py-2">{note}</p>}
      </div>
    </div>
  )
}
