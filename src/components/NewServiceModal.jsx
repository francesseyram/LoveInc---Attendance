import { useState, useEffect } from 'react'
import { getAppConfig, serviceTypeNames } from '../firebase/settings'
import { createService } from '../firebase/services'
import { useAuth } from '../App'

const today = new Date().toISOString().split('T')[0]
const nowTime = new Date().toTimeString().slice(0, 5)

/**
 * Props:
 *   onClose   - callback to close the modal
 *   onCreated - callback(newServiceId) after successful creation
 */
export default function NewServiceModal({ onClose, onCreated }) {
  const [serviceTypes, setServiceTypes] = useState([])

  const { user } = useAuth()

  const [form, setForm] = useState({
    name: '',
    date: today,
    time: nowTime,
    type: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    getAppConfig().then(c => {
      const names = serviceTypeNames(c)
      setServiceTypes(names)
      setForm(f => (f.type ? f : { ...f, type: names[0] || '' }))
    })
  }, [])


  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Service name is required.'); return }
    if (!form.date)         { setError('Date is required.'); return }

    setLoading(true)
    try {
      const id = await createService(form, user?.uid)
      onCreated?.(id)
    } catch (err) {
      console.error(err)
      setError('Failed to create service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-brand-border rounded-2xl w-full max-w-md p-8 animate-slide-up shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-text">New Service</h2>
            <p className="text-brand-muted text-sm mt-1">Create a service and generate a check-in QR code.</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Service Name</label>
            <input type="text" className="input" placeholder="e.g. Sunday Service — Week 3" value={form.name} onChange={set('name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={set('date')} />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" className="input" value={form.time} onChange={set('time')} />
            </div>
          </div>
          <div>
            <label className="label">Service Type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-gold flex-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Creating…
                </span>
              ) : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
