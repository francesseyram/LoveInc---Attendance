import { useEffect, useRef, useState } from 'react'
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

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-9 h-9 rounded-md flex items-center justify-center border border-brand-border text-brand-muted hover:text-gold hover:border-gold/50 transition-colors"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

/** Brand bar. Left-anchored — the old centred stack made every screen feel like a login box. */
function Masthead() {
  const { theme } = useTheme()
  return (
    <header className="border-b border-brand-border">
      <div className="shell flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <img
            src={theme === 'light' ? '/global_black.png' : '/global_white_png.png'}
            alt=""
            className="h-8 w-auto object-contain"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="leading-none">
            <p className="font-display text-lg font-semibold text-brand-text">Love Inc Global</p>
            <p className="eyebrow mt-1">Ashesi · Est. 2022</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

/** Roster rows use '—' as a placeholder surname; never show that to the person. */
function fullName(m) {
  const last = m.lastName && m.lastName !== '—' ? m.lastName : ''
  return `${m.firstName || ''} ${last}`.trim()
}

/** Highlight the letters the person actually typed, so the match is obvious at a glance. */
function Highlight({ text, term }) {
  const q = (term || '').trim()
  if (!q) return text
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return text.split(pattern).map((part, i) =>
    words.includes(part.toLowerCase())
      ? <mark key={i} className="bg-gold/25 text-brand-text rounded-[3px] px-0.5">{part}</mark>
      : <span key={i}>{part}</span>,
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

  // ─── Live search ──────────────────────────────────────────
  // Results resolve as you type. Each run carries a token so a slow earlier
  // query can never overwrite the results of a later keystroke.
  const searchRunRef = useRef(0)

  useEffect(() => {
    const term = searchTerm.trim()
    if (term.length < 2) {
      setResults(null)
      setSearching(false)
      return
    }

    setSearching(true)
    const run = ++searchRunRef.current
    const timer = setTimeout(async () => {
      try {
        // A phone number typed here is an exact lookup, not a name search.
        const asPhone = normalizePhoneKey(term)
        const found = asPhone
          ? [await getMemberByStudentId(asPhone)].filter(Boolean)
          : await searchMembersByName(term)
        if (run === searchRunRef.current) setResults(found)
      } catch (err) {
        console.error(err)
        if (run === searchRunRef.current) setError('Search failed. Check your connection.')
      } finally {
        if (run === searchRunRef.current) setSearching(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [searchTerm])

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

  const Frame = ({ children }) => (
    <div className="min-h-screen flex flex-col">
      <Masthead />
      <main className="shell flex-1 py-10 sm:py-14">{children}</main>
      <footer className="shell py-6">
        <div className="rule mb-3" />
        <p className="eyebrow">Love Inc Global · Attendance</p>
      </footer>
    </div>
  )

  if (pageLoading) {
    return <Frame><div className="py-24"><Spinner /></div></Frame>
  }

  if (notFound) {
    return (
      <Frame>
        <div className="max-w-xl animate-fade-in">
          <p className="eyebrow mb-3">No service</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-text mb-4">
            This link isn't open for check-in.
          </h1>
          <p className="text-brand-muted text-base leading-relaxed">
            The service may have ended, or the link is incomplete. Ask your cell leader
            for today's QR code and scan it again.
          </p>
        </div>
      </Frame>
    )
  }

  if (service?.isCompleted) {
    return (
      <Frame>
        <div className="max-w-xl animate-fade-in">
          <p className="eyebrow mb-3">Closed</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-text mb-4">
            {service.name} has ended.
          </h1>
          <p className="text-brand-muted text-base leading-relaxed">
            Check-in for this service is closed. See you at the next one.
          </p>
        </div>
      </Frame>
    )
  }

  // ── The signature moment: the fellowship says your name back to you. ──
  if (step === 'success' && successData) {
    return (
      <Frame>
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 animate-fade-in">
            {successData.isNew ? 'Welcome to Love Inc' : 'Checked in'}
          </p>
          <h1 className="font-display font-semibold text-brand-text leading-[0.95] animate-name
                         text-[clamp(2.75rem,11vw,6.5rem)]">
            {successData.name}
          </h1>
          <div className="gold-divider my-7 animate-fade-in delay-100" />
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 animate-fade-in delay-200">
            <div>
              <p className="eyebrow mb-1">Service</p>
              <p className="text-brand-text text-sm">{service?.name}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Time</p>
              <p className="text-brand-text text-sm tabular">{successData.time}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Status</p>
              <p className="badge-green">Present</p>
            </div>
          </div>

          <p className="text-brand-muted text-base mt-8 max-w-md leading-relaxed">
            {successData.isNew
              ? "You're on the roll now. Next time, just search your name."
              : 'Good to see you again. Head on in.'}
          </p>

          <div className="mt-8 flex items-center gap-3">
            <button type="button" onClick={resetToStart} className="btn-gold">
              Check in someone else
            </button>
            {kioskMode && <span className="eyebrow">Clearing automatically…</span>}
          </div>
        </div>
      </Frame>
    )
  }

  const showResults = searchTerm.trim().length >= 2

  return (
    <Frame>
      <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">

        {/* ── Left rail: what you're checking into ── */}
        <aside className="animate-fade-in lg:sticky lg:top-14">
          <p className="eyebrow mb-3">{service?.type || 'Service'}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand-text leading-tight">
            {service?.name}
          </h1>
          <div className="gold-divider mt-5 mb-5" />
          <dl className="space-y-3">
            <div>
              <dt className="eyebrow mb-0.5">Date</dt>
              <dd className="text-brand-text text-sm tabular">{service?.date || '—'}</dd>
            </div>
            {service?.time && (
              <div>
                <dt className="eyebrow mb-0.5">Starts</dt>
                <dd className="text-brand-text text-sm tabular">{service.time}</dd>
              </div>
            )}
          </dl>
          {kioskMode && (
            <p className="badge-gold mt-6">Door mode</p>
          )}
        </aside>

        {/* ── Right: the actual job ── */}
        <section className="min-w-0">
          {step === 'choose' && (
            <div className="animate-slide-up max-w-xl">
              <h2 className="font-display text-2xl font-semibold text-brand-text mb-2">Mark yourself present</h2>
              <p className="text-brand-muted mb-7 leading-relaxed">
                Search your name to check in. If you've never been before, register first —
                it takes about twenty seconds.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => { setStep('search'); setError('') }} className="btn-gold px-6 py-3">
                  Find my name
                </button>
                <button type="button" onClick={() => { setStep('first'); setError('') }} className="btn-ghost px-6 py-3">
                  I'm new here
                </button>
              </div>
            </div>
          )}

          {step === 'search' && (
            <div className="animate-slide-up max-w-xl">
              <h2 className="font-display text-2xl font-semibold text-brand-text mb-2">Find your name</h2>
              <p className="text-brand-muted mb-6 leading-relaxed">
                Start typing — matches appear as you go. Tap yourself to check in.
              </p>

              <label className="label" htmlFor="name-search">Your name</label>
              <div className="relative">
                <input
                  id="name-search"
                  type="text"
                  className="input pr-11 text-lg"
                  placeholder="Start typing…"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setError('') }}
                  autoFocus
                  autoComplete="off"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {searching
                    ? <span className="block w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4 text-brand-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" />
                      </svg>}
                </span>
              </div>
              <p className="text-brand-subtle text-xs mt-2">A phone number works too.</p>

              {error && (
                <p className="badge-red mt-4 !block !rounded-md px-3 py-2">{error}</p>
              )}

              {showResults && results !== null && (
                <div className="mt-7">
                  {results.length === 0 ? (
                    <div className="card">
                      <p className="text-brand-text text-sm mb-1">No one matches "{searchTerm.trim()}".</p>
                      <p className="text-brand-muted text-sm mb-5">
                        Try your surname, or a different spelling. First time here?
                      </p>
                      <button type="button" onClick={() => { setStep('first'); setError('') }} className="btn-gold">
                        Register instead
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="eyebrow mb-3">
                        {results.length} {results.length === 1 ? 'match' : 'matches'}
                      </p>
                      <ul className="space-y-2">
                        {results.map((m, i) => (
                          <li key={m.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => markPresent(m)}
                              className="group w-full text-left px-4 py-3.5 rounded-md border border-brand-border bg-surface
                                         hover:border-gold/60 hover:bg-surface-hover transition-all disabled:opacity-50
                                         flex items-center justify-between gap-4"
                            >
                              <span className="min-w-0">
                                <span className="block text-brand-text font-medium truncate">
                                  <Highlight text={fullName(m)} term={searchTerm} />
                                </span>
                                <span className="block text-brand-subtle text-xs mt-0.5 tabular truncate">
                                  {[m.cohort, maskPhone(m.studentId), m.hostel].filter(Boolean).join('  ·  ') || 'No details on file'}
                                </span>
                              </span>
                              <span className="eyebrow shrink-0 text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                                That's me →
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <button type="button" onClick={resetToStart} className="btn-ghost mt-7">Back</button>
            </div>
          )}

          {step === 'first' && (
            <div className="animate-slide-up max-w-2xl">
              <h2 className="font-display text-2xl font-semibold text-brand-text mb-2">Welcome — tell us who you are</h2>
              <p className="text-brand-muted mb-7 leading-relaxed">
                Only your name and phone number are required. Everything else helps us
                keep in touch.
              </p>
              <form onSubmit={handleFirstTimerSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">First name *</label>
                    <input type="text" className="input" placeholder="Kwame" value={firstForm.firstName} onChange={setFF('firstName')} />
                  </div>
                  <div>
                    <label className="label">Last name *</label>
                    <input type="text" className="input" placeholder="Mensah" value={firstForm.lastName} onChange={setFF('lastName')} />
                  </div>
                </div>
                <div>
                  <label className="label">Phone number *</label>
                  <input type="tel" className="input tabular" placeholder="0XX XXX XXXX" value={firstForm.phone} onChange={setFF('phone')} />
                  <p className="text-brand-subtle text-xs mt-1.5">This is how you'll check in next time.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
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
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="you@ashesi.edu.gh" value={firstForm.email} onChange={setFF('email')} />
                </div>
                <div>
                  <label className="label">Birthday</label>
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <select className="input" value={firstForm.birthMonth} onChange={setFF('birthMonth')}>
                      <option value="">Month</option>
                      {MONTH_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select className="input" value={firstForm.birthDay} onChange={setFF('birthDay')}>
                      <option value="">Day</option>
                      {DAY_OPTIONS.map(d => <option key={d} value={d}>{Number(d)}</option>)}
                    </select>
                  </div>
                  <p className="text-brand-subtle text-xs mt-1.5">Day and month only — we don't ask for the year.</p>
                </div>

                {error && <p className="badge-red !block !rounded-md px-3 py-2">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={submitting} className="btn-gold px-6 py-3">
                    {submitting ? 'Checking in…' : 'Register and check in'}
                  </button>
                  <button type="button" onClick={resetToStart} className="btn-ghost px-6 py-3">Back</button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </Frame>
  )
}
