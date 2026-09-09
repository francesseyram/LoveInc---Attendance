import { useEffect, useRef, useState } from 'react'
import { getServiceFlier, setServiceFlier, removeServiceFlier, prepareFlierImage } from '../firebase/fliers'

/**
 * Attach the service flier that gets shown on the check-in page.
 *
 * Props: service, uid, onClose, onSaved
 */
export default function FlierModal({ service, uid, onClose, onSaved }) {
  const [loading, setLoading]   = useState(true)
  const [preview, setPreview]   = useState(null)   // { dataUrl, width, height, bytes }
  const [existing, setExisting] = useState(false)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    let alive = true
    getServiceFlier(service.id)
      .then(f => {
        if (!alive) return
        if (f) { setPreview(f); setExisting(true) }
      })
      .catch(() => setError('Could not load the current flier.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [service.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      setPreview(await prepareFlierImage(file))
    } catch (err) {
      setError(err.message || 'Could not read that image.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!preview?.dataUrl) return
    setBusy(true)
    setError('')
    try {
      await setServiceFlier(service.id, preview, uid)
      onSaved?.()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save the flier. Check your connection and try again.')
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await removeServiceFlier(service.id)
      onSaved?.()
      onClose()
    } catch {
      setError('Could not remove the flier.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card w-full max-w-md animate-slide-up">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-2xl text-brand-text">Service flier</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text p-1" aria-label="Close">✕</button>
        </div>
        <p className="text-brand-muted text-sm mb-5">
          Shown on the check-in page for <span className="text-brand-text">{service.name}</span>.
          Portrait images look best.
        </p>

        <div className="rounded-md border border-brand-border bg-surface-elevated overflow-hidden mb-4
                        flex items-center justify-center min-h-[220px]">
          {loading ? (
            <span className="text-brand-subtle text-sm">Loading…</span>
          ) : preview?.dataUrl ? (
            <img src={preview.dataUrl} alt="" className="w-full h-auto max-h-[46vh] object-contain" />
          ) : (
            <div className="text-center px-6 py-10">
              <p className="text-brand-text text-sm mb-1">No flier yet</p>
              <p className="text-brand-subtle text-xs">Add one and it appears beside the check-in search.</p>
            </div>
          )}
        </div>

        {preview?.bytes && (
          <p className="eyebrow mb-4">
            {preview.width}×{preview.height} · {Math.round(preview.bytes / 1024)} KB
          </p>
        )}

        {error && <p className="badge-red !block !rounded-md px-3 py-2 mb-4">{error}</p>}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost">
            {preview?.dataUrl ? 'Choose another' : 'Choose image'}
          </button>
          <button type="button" onClick={save} disabled={busy || !preview?.dataUrl} className="btn-gold">
            {busy ? 'Working…' : 'Save flier'}
          </button>
          {existing && (
            <button type="button" onClick={remove} disabled={busy} className="btn-danger ml-auto">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
