import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getServiceById } from '../firebase/services'
import { getMemberByStudentId, createMember, studentIdExists } from '../firebase/members'
import { checkIn, hasCheckedIn } from '../firebase/attendance'
import { useTheme } from '../App'

// ─── Sub-components ──────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function FloatingThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border border-brand-border bg-surface-elevated text-brand-muted hover:text-gold hover:border-gold/40 transition-all duration-200"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function Logo() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <img
        src={isLight ? '/global_black.png' : '/global_white_png.png'}
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
  const [step,         setStep]         = useState('choose') // 'choose' | 'first' | 'returning' | 'success'
  const [successData,  setSuccessData]  = useState(null)
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const [firstForm, setFirstForm] = useState({
    firstName: '', lastName: '', studentId: '', phone: '', email: '', birthday: '',
  })
  const [studentIdInput, setStudentIdInput] = useState('')

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
      const exists = await studentIdExists(studentId.trim())
      if (exists) {
        setError('This Student ID is already registered. Please use "Been here before?" to check in.')
        setSubmitting(false)
        return
      }

      const existing = await getMemberByStudentId(studentId.trim())
      if (existing) {
        const dup = await hasCheckedIn(existing.id, serviceId)
        if (dup) {
          setError('You have already checked in to this service.')
          setSubmitting(false)
          return
        }
      }

      const memberId = await createMember({ ...firstForm, createdBy: 'self' })
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center relative">
        <FloatingThemeToggle />
        <Spinner />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative">
        <FloatingThemeToggle />
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

  // Service ended (completed) — block check-in
  if (service?.isCompleted) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative">
        <FloatingThemeToggle />
        <div className="w-full max-w-sm text-center animate-fade-in">
          <Logo />
          <div className="card mt-4 border-brand-border">
            <p className="text-4xl mb-3">✓</p>
            <h2 className="font-display text-2xl text-brand-text mb-2">This service has ended</h2>
            <p className="text-brand-muted text-sm">
              Check-in is closed for <span className="text-brand-text font-medium">{service.name}</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success' && successData) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative">
        <FloatingThemeToggle />
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
          </div>
          <p className="text-brand-subtle text-xs mt-6">
            Love Inc Global · {service?.name}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 relative">
      <FloatingThemeToggle />
      <div className="w-full max-w-sm">
        <div className="animate-fade-in">
          <Logo />
        </div>

        <div className="card mb-6 text-center animate-slide-up delay-100">
          <p className="text-brand-subtle text-xs uppercase tracking-widest mb-1">{service?.type}</p>
          <h2 className="font-display text-2xl font-semibold text-brand-text">{service?.name}</h2>
          <p className="text-brand-muted text-sm mt-1">
            {service?.date}
            {service?.time && ` · ${service.time}`}
          </p>
        </div>

        {step === 'choose' && (
          <div className="space-y-3 animate-slide-up delay-200">
            <p className="text-center text-brand-muted text-sm mb-4">Is this your first time at Love Inc?</p>
            <button
              type="button"
              onClick={() => { setStep('first'); setError('') }}
              className="w-full btn-gold py-4 text-base"
            >
              First time here!
            </button>
            <button
              type="button"
              onClick={() => { setStep('returning'); setError('') }}
              className="w-full btn-ghost py-4 text-base"
            >
              Been here before
            </button>
          </div>
        )}

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
                type="button"
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
