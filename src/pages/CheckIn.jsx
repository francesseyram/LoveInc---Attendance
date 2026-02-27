import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getServiceById } from '../firebase/services'
import { getMemberByStudentId, createMember, studentIdExists } from '../firebase/members'
import { checkIn, hasCheckedIn, subscribeToServiceAttendance } from '../firebase/attendance'

// ─── Sub-components ──────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Logo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <img
        src="/global_white_png.png"
        alt="Love Inc Global"
        className="h-20 w-auto object-contain"
        onError={(e) => { e.target.style.display = 'none' }}
      />
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-gold tracking-wide">Love Inc Global</h1>
        <p className="text-brand-subtle text-xs tracking-widest uppercase mt-1">Est. 2022 · Ashesi University</p>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────
export default function CheckIn() {
  const [params]    = useSearchParams()
  const serviceId   = params.get('s')

  const [service,      setService]      = useState(null)
  const [pageLoading,  setPageLoading]  = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [count,        setCount]        = useState(0)
  const [step,         setStep]         = useState('choose') // 'choose' | 'first' | 'returning' | 'success'
  const [successData,  setSuccessData]  = useState(null)
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  // First-timer form state
  const [firstForm, setFirstForm] = useState({
    firstName: '', lastName: '', studentId: '', phone: '', email: '', birthday: '',
  })

  // Returning member state
  const [studentIdInput, setStudentIdInput] = useState('')

  // Load service
  useEffect(() => {
    if (!serviceId) {
      setNotFound(true)
      setPageLoading(false)
      return
    }
    getServiceById(serviceId)
      .then(s => {
        if (!s) setNotFound(true)
        else setService(s)
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false))
  }, [serviceId])

  // Real-time check-in count
  useEffect(() => {
    if (!serviceId) return
    const unsub = subscribeToServiceAttendance(serviceId, (records) => {
      setCount(records.length)
    })
    return unsub
  }, [serviceId])

  // ─── Handlers ─────────────────────────────────────────────

  const setFF = (field) => (e) => setFirstForm(p => ({ ...p, [field]: e.target.value }))

  const handleFirstTimerSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const { firstName, lastName, studentId } = firstForm
    if (!firstName.trim() || !lastName.trim() || !studentId.trim()) {
      setError('First name, last name, and Student ID are required.')
      return
    }

    setSubmitting(true)
    try {
      // Check if student ID already exists
      const exists = await studentIdExists(studentId.trim())
      if (exists) {
        setError('This Student ID is already registered. Please use "Been here before?" to check in.')
        setSubmitting(false)
        return
      }

      // Check for duplicate check-in (by student ID lookup)
      const existing = await getMemberByStudentId(studentId.trim())
      if (existing) {
        const dup = await hasCheckedIn(existing.id, serviceId)
        if (dup) {
          setError('You have already checked in to this service.')
          setSubmitting(false)
          return
        }
      }

      // Create member
      const memberId = await createMember({ ...firstForm, createdBy: 'self' })

      // Check in
      await checkIn(memberId, serviceId, true)

      setSuccessData({
        name:  `${firstForm.firstName} ${firstForm.lastName}`,
        time:  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        isNew: true,
      })
      setStep('success')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturningSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!studentIdInput.trim()) {
      setError('Please enter your Student ID.')
      return
    }

    setSubmitting(true)
    try {
      const member = await getMemberByStudentId(studentIdInput.trim())
      if (!member) {
        setError("We couldn't find you. If this is your first time, please use the first-timer form.")
        setSubmitting(false)
        return
      }

      const dup = await hasCheckedIn(member.id, serviceId)
      if (dup) {
        setError(`${member.firstName}, you've already checked in to this service. See you inside! 👋`)
        setSubmitting(false)
        return
      }

      await checkIn(member.id, serviceId, false)

      setSuccessData({
        name:  `${member.firstName} ${member.lastName}`,
        time:  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        isNew: false,
      })
      setStep('success')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render states ─────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <Logo />
          <div className="card mt-4">
            <p className="text-4xl mb-4">🔍</p>
            <h2 className="font-display text-2xl text-brand-text mb-2">Service not found</h2>
            <p className="text-brand-muted text-sm">
              The check-in link appears to be invalid or the service has ended.
              Ask your cell leader for the correct link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Success ──────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center animate-slide-up">
          <Logo />

          <div className="card border-gold/30 bg-gold/5 shadow-gold">
            <div className="text-5xl mb-4">{successData.isNew ? '🎉' : '✅'}</div>
            <h2 className="font-display text-3xl font-semibold text-gold mb-2">
              {successData.isNew ? 'Welcome!' : 'Checked In!'}
            </h2>
            <p className="text-brand-text text-lg font-medium mb-1">{successData.name}</p>
            <p className="text-brand-muted text-sm mb-4">
              {successData.isNew
                ? 'So glad you joined us for the first time! You\'re now officially part of the family.'
                : `Welcome back! Checked in at ${successData.time}`
              }
            </p>

            <div className="gold-divider mb-4" />

            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-brand-muted text-sm">
                <span className="text-gold font-semibold">{count}</span> people in service
              </span>
            </div>
          </div>

          <p className="text-brand-subtle text-xs mt-6">
            Love Inc Global · {service?.name}
          </p>
        </div>
      </div>
    )
  }

  // ─── Main check-in UI ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="animate-fade-in">
          <Logo />
        </div>

        {/* Service info card */}
        <div className="card mb-6 text-center animate-slide-up delay-100">
          <p className="text-brand-subtle text-xs uppercase tracking-widest mb-1">{service?.type}</p>
          <h2 className="font-display text-2xl font-semibold text-brand-text">{service?.name}</h2>
          <p className="text-brand-muted text-sm mt-1">
            {service?.date}
            {service?.time && ` · ${service.time}`}
          </p>
          <div className="gold-divider my-4" />
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-brand-muted text-sm">
              <span className="text-gold font-semibold font-display text-lg">{count}</span> {count === 1 ? 'person' : 'people'} checked in
            </span>
          </div>
        </div>

        {/* ── Step: Choose ── */}
        {step === 'choose' && (
          <div className="space-y-3 animate-slide-up delay-200">
            <p className="text-center text-brand-muted text-sm mb-4">Is this your first time at Love Inc?</p>
            <button
              onClick={() => { setStep('first'); setError('') }}
              className="w-full btn-gold py-4 text-base"
            >
              🎉 First time here!
            </button>
            <button
              onClick={() => { setStep('returning'); setError('') }}
              className="w-full btn-ghost py-4 text-base"
            >
              👋 Been here before
            </button>
          </div>
        )}

        {/* ── Step: First Timer ── */}
        {step === 'first' && (
          <div className="card animate-slide-up">
            <h3 className="font-display text-xl font-semibold text-brand-text mb-1">Welcome!</h3>
            <p className="text-brand-muted text-sm mb-5">Tell us a little about yourself.</p>

            <form onSubmit={handleFirstTimerSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input type="text" className="input" placeholder="Kwame" value={firstForm.firstName} onChange={setFF('firstName')} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input type="text" className="input" placeholder="Mensah" value={firstForm.lastName} onChange={setFF('lastName')} />
                </div>
              </div>
              <div>
                <label className="label">Student ID *</label>
                <input type="text" className="input" placeholder="e.g. 3987654" value={firstForm.studentId} onChange={setFF('studentId')} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" className="input" placeholder="+233 XX XXX XXXX" value={firstForm.phone} onChange={setFF('phone')} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="you@ashesi.edu.gh" value={firstForm.email} onChange={setFF('email')} />
              </div>
              <div>
                <label className="label">Birthday</label>
                <input type="date" className="input" value={firstForm.birthday} onChange={setFF('birthday')} />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep('choose'); setError('') }} className="btn-ghost flex-1">
                  Back
                </button>
                <button type="submit" disabled={submitting} className="btn-gold flex-1">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Checking in…
                    </span>
                  ) : 'Check In'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step: Returning Member ── */}
        {step === 'returning' && (
          <div className="card animate-slide-up">
            <h3 className="font-display text-xl font-semibold text-brand-text mb-1">Welcome back!</h3>
            <p className="text-brand-muted text-sm mb-5">Enter your Student ID to check in.</p>

            <form onSubmit={handleReturningSubmit} className="space-y-4">
              <div>
                <label className="label">Student ID</label>
                <input
                  type="text"
                  className="input text-center text-lg tracking-wider"
                  placeholder="e.g. 3987654"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep('choose'); setError('') }} className="btn-ghost flex-1">
                  Back
                </button>
                <button type="submit" disabled={submitting} className="btn-gold flex-1">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Checking in…
                    </span>
                  ) : 'Check In'}
                </button>
              </div>
            </form>

            <p className="text-center text-brand-subtle text-xs mt-4">
              First time?{' '}
              <button
                onClick={() => { setStep('first'); setError('') }}
                className="text-gold hover:text-gold-light transition-colors"
              >
                Register here
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-brand-subtle text-xs mt-8">
          Love Inc Global · Est. 2022 · Ashesi University, Ghana
        </p>
      </div>
    </div>
  )
}
