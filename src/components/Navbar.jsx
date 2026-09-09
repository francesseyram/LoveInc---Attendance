import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from '../firebase/auth'
import { useAuth }  from '../App'
import { useTheme } from '../App'

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export default function Navbar() {
  const { user }          = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate          = useNavigate()
  const location          = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinks = [
    { to: '/admin',             label: 'Dashboard'   },
    { to: '/admin/service/new', label: 'New Service' },
  ]

  const isLight = theme === 'light'

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md border-b border-brand-border"
      style={{ backgroundColor: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,10,0.92)' }}
    >
      {/* Gradient accent line at top (light mode) */}
      {isLight && (
        <div className="h-0.5 w-full" style={{
          background: 'linear-gradient(90deg, #7C3AED 0%, #A855F7 50%, #C084FC 100%)'
        }} />
      )}

      <div className="shell">
        <div className="flex items-center justify-between h-16">

          {/* Logo + Brand */}
          <Link to="/admin" className="flex items-center gap-3 group">
            <img
              src={isLight ? '/global_crimson.png' : '/global_white_png.png'}
              alt="Love Inc Global"
              className="h-9 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div>
              <p className="font-display text-gold text-lg font-semibold leading-none tracking-wide">
                Love Inc Global
              </p>
              <p className="text-brand-subtle text-xs leading-none mt-0.5">
                Attendance Portal
              </p>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === to
                    ? 'text-gold bg-gold/10'
                    : 'text-brand-muted hover:text-brand-text hover:bg-surface'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right: theme toggle + user + sign out */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:text-gold hover:bg-gold/10 transition-all duration-200"
              aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              title={isLight ? 'Dark mode' : 'Light mode'}
            >
              {isLight ? <MoonIcon /> : <SunIcon />}
            </button>

            {user && (
              <span className="hidden sm:block text-brand-subtle text-xs truncate max-w-[180px]">
                {user.email}
              </span>
            )}

            <button onClick={handleSignOut} className="btn-ghost text-sm py-2 px-4">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
