import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../firebase/auth'
import { useAuth, useTheme } from '../App'

export default function Login() {
  const { theme } = useTheme()
  const navigate    = useNavigate()
  const { user, authLoading } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  // If already authed, go to admin
  useEffect(() => {
    if (!authLoading && user) navigate('/admin', { replace: true })
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment and try again.')
      } else {
        setError('Failed to sign in. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center">
      <div className="shell grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-16">

        {/* Left: who this is for */}
        <div className="animate-fade-in">
          <img
            src={theme === 'light' ? '/global_crimson.png' : '/global_white_png.png'}
            alt="Love Inc Global"
            className="h-20 w-auto object-contain mb-7"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <p className="eyebrow mb-4">Admin portal</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-text leading-[1.05] mb-5">
            Who came,<br />and who we<br />haven't seen.
          </h1>
          <div className="gold-divider mb-5" />
          <p className="text-brand-muted leading-relaxed max-w-sm">
            Attendance for Love Inc Global — services, the roll, and who's drifted.
            Sign in to pick up where the fellowship left off.
          </p>
        </div>

        {/* Right: the form */}
        <div className="w-full max-w-md lg:justify-self-end animate-slide-up">
        <div className="card">
          <h2 className="font-display text-2xl font-semibold text-brand-text mb-1">Sign in</h2>
          <p className="text-brand-muted text-sm mb-6">Admin access only. Contact your superadmin if you need access.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-subtle hover:text-brand-muted transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-gold w-full mt-2 py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="eyebrow mt-6">Est. 2022 · Ashesi University</p>
        </div>
      </div>
    </div>
  )
}
