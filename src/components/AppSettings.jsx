import { useEffect, useState } from 'react'
import { getAppConfig, saveAppConfig, DEFAULTS } from '../firebase/settings'

/**
 * Editor for `config/app` — service types, extra class options, and the rule
 * that decides who counts as inactive. These used to be literals in the
 * components; keeping them here means changing them never needs a deploy.
 *
 * Props: canEdit (admins and superadmins only)
 */
export default function AppSettings({ canEdit }) {
  const [types, setTypes]     = useState([])
  const [classes, setClasses] = useState('')
  const [inactive, setInactive] = useState(DEFAULTS.inactiveAfterMissedServices)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [note, setNote]       = useState('')
  const [error, setError]     = useState('')

  useEffect(() => {
    getAppConfig({ force: true })
      .then(c => {
        setTypes(c.serviceTypes)
        setClasses((c.classOptions || []).join(', '))
        setInactive(c.inactiveAfterMissedServices)
      })
      .finally(() => setLoading(false))
  }, [])

  const setType = (i, key) => (e) =>
    setTypes(ts => ts.map((t, n) => (n === i ? { ...t, [key]: e.target.value } : t)))

  const addType    = () => setTypes(ts => [...ts, { name: '', icon: '•' }])
  const removeType = (i) => setTypes(ts => ts.filter((_, n) => n !== i))

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
        classOptions: classes.split(',').map(c => c.trim()).filter(Boolean),
        inactiveAfterMissedServices: n,
      })
      setTypes(cleaned)
      setNote('Saved. Reload the dashboard to see the new values applied.')
    } catch (err) {
      console.error(err)
      setError('Could not save. Check your connection and that you are still signed in.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="card text-center py-14 text-brand-muted text-sm">Loading settings…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h3 className="font-display text-xl text-brand-text mb-1">Service types</h3>
        <p className="text-brand-muted text-sm mb-5">Offered when creating a service.</p>

        <div className="space-y-2">
          {types.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input w-16 text-center" value={t.icon || ''} onChange={setType(i, 'icon')}
                disabled={!canEdit} aria-label="Icon"
              />
              <input
                className="input" value={t.name} onChange={setType(i, 'name')}
                placeholder="Service type" disabled={!canEdit} aria-label="Type name"
              />
              {canEdit && (
                <button type="button" onClick={() => removeType(i)} className="btn-ghost px-3 shrink-0">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <button type="button" onClick={addType} className="btn-ghost mt-3">Add type</button>
        )}
      </div>

      <div className="card">
        <h3 className="font-display text-xl text-brand-text mb-1">Class options</h3>
        <p className="text-brand-muted text-sm mb-4">
          Class years already in the roster are offered automatically. These are the extras —
          for people who aren't a cohort.
        </p>
        <input
          className="input" value={classes} onChange={e => setClasses(e.target.value)}
          placeholder="Staff, Alumni, Visitor" disabled={!canEdit}
        />
        <p className="text-brand-subtle text-xs mt-1.5">Separate with commas.</p>
      </div>

      <div className="card">
        <h3 className="font-display text-xl text-brand-text mb-1">Activity rule</h3>
        <p className="text-brand-muted text-sm mb-4">
          How many recent services someone can miss before the Stats tab counts them inactive.
        </p>
        <input
          type="number" min="1" max="20" className="input tabular max-w-[7rem]"
          value={inactive} onChange={e => setInactive(e.target.value)} disabled={!canEdit}
        />
        <p className="text-brand-subtle text-xs mt-1.5">
          Inactive = no check-in in the last {Number(inactive) || '—'} services.
        </p>
      </div>

      {error && <p className="badge-red !block !rounded-md px-3 py-2">{error}</p>}
      {note  && <p className="badge-green !block !rounded-md px-3 py-2">{note}</p>}

      {canEdit ? (
        <button type="button" onClick={save} disabled={busy} className="btn-gold px-6 py-3">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      ) : (
        <p className="text-brand-muted text-sm">Only admins can change these.</p>
      )}
    </div>
  )
}
