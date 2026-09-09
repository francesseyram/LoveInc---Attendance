import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getServiceById, getActiveService } from '../firebase/services'
import {
  getMemberByStudentId, createMember, studentIdExists,
  normalizePhoneKey, searchMembersByName, maskPhone, invalidateMemberSearchCache,
} from '../firebase/members'
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

const MONTH_OPTIONS = [
  ['01','January'],['02','February'],['03','March'],['04','April'],['05','May'],['06','June'],
  ['07','July'],['08','August'],['09','September'],['10','October'],['11','November'],['12','December'],
]
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
// Ashesi class years. Matches the `cohort` values imported from the church roster.
const CLASS_OPTIONS = ['C2026','C2027','C2028','C2029','C2030','Staff','Alumni','Visitor']

// ─── Main Component ──────────────────────────────────────────
export default function CheckIn() {
  const [params]    = useSearchParams()
  const serviceId   = params.get('s')
  // A shared tablet at the door behaves differently from someone's own phone:
  // it clears itself after each person so the next one can walk up.
  const kioskMode   = params.get('kiosk') === '1'

  const [service,      setService]      = useState(null)
  const [pageLoading,  setPageLoading]  = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [step,         setStep]         = useState('choose') // 'choose' | 'first' | 'returning' | 'success'
  const [successData,  setSuccessData]  = useState(null)
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const [firstForm, setFirstForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    birthMonth: '', birthDay: '', cohort: '', hostel: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [results,    setResults]    = useState(null)   // null = not searched yet
  const [searching,  setSearching]  = useState(false)

  useEffect(() => {
    // QR codes carry ?s={serviceId}. A bare /checkin falls back to the active
    // service so a printed link keeps working week to week.
    const load = serviceId ? getServiceById(serviceId) : getActiveService()
    load
      .then(s => {
        if (!s) setNotFound(true)
        else setService(s)
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false))
  }, [serviceId])

  const activeId = service?.id

  const setFF = (field) => (e) => setFirstForm(p => ({ ...p, [field]: e.target.value }))

  const handleFirstTimerSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const { firstName, lastName, phone, birthMonth, birthDay } = firstForm
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('First name, last name, and phone number are required.')
      return
    }

    const phoneKey = normalizePhoneKey(phone)
    if (!phoneKey) {
      setError("That phone number doesn't look right. Use the format 0XX XXX XXXX.")
      return
    }

    setSubmitting(true)
    try {
      const exists = await studentIdExists(phoneKey)
      if (exists) {
        setError('This number is already registered. Please use "Been here before" to check in.')
        setSubmitting(false)
        return
      }

      const existing = await getMemberByStudentId(phoneKey)
      if (existing) {
        const dup = await hasCheckedIn(existing.id, activeId)
        if (dup) {
          setError('You have already checked in to this service.')
          setSubmitting(false)
          return
        }
      }

      const birthdayMD = birthMonth && birthDay ? `${birthMonth}-${birthDay}` : ''
      invalidateMemberSearchCache()
      const memberId = await createMember({
        ...firstForm, studentId: phoneKey, birthdayMD, birthday: '', createdBy: 'self',
      })
      await checkIn(memberId, activeId, true)

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

  // ─── Search by name (primary returning path) ───────────────
  const handleSearch = async (e) => {
    e?.preventDefault()
    setError('')
    const term = searchTerm.trim()
    if (term.length < 2) {
      setError('Type at least two letters of your name.')
      return
    }

    setSearching(true)
    try {
      // Someone may still type a phone number here — treat that as an exact lookup.
      const asPhone = normalizePhoneKey(term)
      if (asPhone) {
        const m = await getMemberByStudentId(asPhone)
        setResults(m ? [m] : [])
      } else {
        setResults(await searchMembersByName(term))
      }
    } catch (err) {
      console.error(err)
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  /** Mark one specific, confirmed person present. Never called from a bare search hit. */
  const markPresent = async (member) => {
    setError('')
    setSubmitting(true)
    try {
      const dup = await hasCheckedIn(member.id, activeId)
      if (dup) {
        setError(`${member.firstName}, you've already checked in to this service. See you inside! 👋`)
        setSubmitting(false)
        return
      }

      await checkIn(member.id, activeId, false)
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

  /** Wipe every transient bit of state so the next person starts clean. */
  const resetToStart = () => {
    setStep('choose'); setError(''); setSuccessData(null)
    setSearchTerm(''); setResults(null)
    setFirstForm({ firstName: '', lastName: '', phone: '', email: '',
                   birthMonth: '', birthDay: '', cohort: '', hostel: '' })
  }

  // On a shared device, hand the screen back automatically.
  useEffect(() => {
    if (step !== 'success' || !kioskMode) return
    const t = setTimeout(resetToStart, 6000)
    return () => clearTimeout(t)
  }, [step, kioskMode])

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
          {kioskMode && (
            <button type="button" onClick={resetToStart} className="btn-gold w-full mt-5 py-3">
              Next person
            </button>
          )}
          <p className="text-brand-subtle text-xs mt-6">
            Love Inc Global · {service?.name}
            {kioskMode && <span className="block mt-1">Returning to search…</span>}
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
            <p className="text-center text-brand-muted text-sm mb-4">Mark yourself present</p>
            <button
              type="button"
              onClick={() => { setStep('search'); setError('') }}
              className="w-full btn-gold py-4 text-base"
            >
              Find my name
            </button>
            <button
              type="button"
              onClick={() => { setStep('first'); setError('') }}
              className="w-full btn-ghost py-4 text-base"
            >
              I'm new here
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
                <label className="label">Phone Number *</label>
                <input type="tel" className="input" placeholder="0XX XXX XXXX" value={firstForm.phone} onChange={setFF('phone')} />
                <p className="text-brand-subtle text-xs mt-1">This is how you'll check in next time.</p>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="you@ashesi.edu.gh" value={firstForm.email} onChange={setFF('email')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Class</label>
                  <select className="input" value={firstForm.cohort} onChange={setFF('cohort')}>
                    <option value="">Select…</option>
                    {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Hostel</label>
                  <input type="text" className="input" placeholder="e.g. Dufie" value={firstForm.hostel} onChange={setFF('hostel')} />
                </div>
              </div>
              <div>
                <label className="label">Birthday</label>
                <div className="grid grid-cols-2 gap-3">
                  <select className="input" value={firstForm.birthMonth} onChange={setFF('birthMonth')}>
                    <option value="">Month</option>
                    {MONTH_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select className="input" value={firstForm.birthDay} onChange={setFF('birthDay')}>
                    <option value="">Day</option>
                    {DAY_OPTIONS.map(d => <option key={d} value={d}>{Number(d)}</option>)}
                  </select>
                </div>
                <p className="text-brand-subtle text-xs mt-1">Day and month only — we don't ask for the year.</p>
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

        {step === 'search' && (
          <div className="card animate-slide-up">
            <h3 className="font-display text-xl font-semibold text-brand-text mb-1">Find your name</h3>
            <p className="text-brand-muted text-sm mb-5">Search your name, then tap yourself in the list.</p>

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="label">Your Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Kwame Mensah"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setResults(null); setError('') }}
                    autoFocus
                  />
                  <button type="submit" disabled={searching} className="btn-gold px-5 shrink-0">
                    {searching ? '…' : 'Search'}
                  </button>
                </div>
                <p className="text-brand-subtle text-xs mt-1">You can also type your phone number.</p>
              </div>
            </form>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2 mt-4">{error}</p>
            )}

            {results !== null && !searching && (
              <div className="mt-5">
                {results.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-brand-muted text-sm mb-1">No one found for "{searchTerm}".</p>
                    <p className="text-brand-subtle text-xs mb-4">Check the spelling, or register as a new member.</p>
                    <button type="button" onClick={() => { setStep('first'); setError('') }} className="btn-gold px-6">
                      I'm new here
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="label mb-2">
                      {results.length === 1 ? 'Is this you?' : `${results.length} matches — tap yourself`}
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {results.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={submitting}
                          onClick={() => markPresent(m)}
                          className="w-full text-left px-4 py-3 rounded-lg border border-brand-border bg-surface-elevated hover:border-gold/40 hover:bg-surface-hover transition-all disabled:opacity-50"
                        >
                          <p className="text-brand-text font-medium text-sm">{m.firstName} {m.lastName}</p>
                          <p className="text-brand-subtle text-xs mt-0.5">
                            {[m.cohort, maskPhone(m.studentId), m.hostel].filter(Boolean).join(' · ') || 'No other details'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={resetToStart} className="btn-ghost flex-1">Back</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
