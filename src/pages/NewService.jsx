import { useState, useEffect } from 'react'
import { getAppConfig, serviceTypeNames } from '../firebase/settings'
import { useNavigate } from 'react-router-dom'
import { createService } from '../firebase/services'
import { useAuth } from '../App'
import Navbar from '../components/Navbar'
import QRModal from '../components/QRModal'

const today   = new Date().toISOString().split('T')[0]
const nowTime = new Date().toTimeString().slice(0, 5)

export default function NewService() {
  const [serviceTypes, setServiceTypes] = useState([])

  useEffect(() => {
    getAppConfig().then(c => {
      const names = serviceTypeNames(c)
      setServiceTypes(names)
      setForm(f => (f.type ? f : { ...f, type: names[0] || '' }))
    })
  }, [])

  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [form, setForm] = useState({
    name: '',
    date: today,
    time: nowTime,
    type: '',
  })
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [newService, setNewService] = useState(null) // triggers QR modal

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Service name is required.'); return }
    if (!form.date)         { setError('Date is required.'); return }

    setLoading(true)
    try {
      const id = await createService(form, user?.uid)
      setNewService({ id, ...form, isActive: true })
    } catch (err) {
      console.error(err)
      setError('Failed to create service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="text-brand-muted hover:text-brand-text transition-colors text-sm flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="font-display text-4xl font-semibold text-brand-text">New Service</h1>
          <p className="text-brand-muted text-sm mt-1">
            Create a new service. Once created, it becomes the active service and a QR code is generated.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Service Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Sunday Service — Week 7"
                value={form.name}
                onChange={set('name')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date *</label>
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
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/admin')} className="btn-ghost flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-gold flex-1">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : 'Create & Get QR Code'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-brand-subtle text-xs text-center mt-6">
          All existing active services will be deactivated when this service is created.
        </p>
      </main>

      {newService && (
        <QRModal
          service={newService}
          onClose={() => navigate('/admin')}
        />
      )}
    </div>
  )
}
