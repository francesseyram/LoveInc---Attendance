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
    /* Quiet bar. Brand shows up in the crest and the active-tab rule only. */
    <header className="brand-band sticky top-0 z-50">
      <div className="w-full px-5 sm:px-7 lg:px-9">
        <div className="flex items-center justify-between h-[4.5rem] gap-6 sm:gap-10">

          <Link to="/admin" className="flex items-center gap-3 shrink-0">
            <img
              src={isLight ? '/global_crimson.png' : '/global_white_png.png'}
              alt=""
              className="h-9 w-auto object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="hidden sm:block leading-none">
              <p className="font-display text-lg leading-none text-brand-text">Love Inc Global</p>
              <p className="eyebrow mt-1">Attendance</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={location.pathname === to ? 'band-link band-link-active' : 'band-link'}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              className="band-icon"
              aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              title={isLight ? 'Dark mode' : 'Light mode'}
            >
              {isLight ? <MoonIcon /> : <SunIcon />}
            </button>

            {user && (
              <span className="hidden lg:block text-brand-subtle text-xs truncate max-w-[180px]">
                {user.email}
              </span>
            )}

            <button onClick={handleSignOut} className="band-btn">Sign out</button>
          </div>
        </div>
      </div>
    </header>
  )
}
