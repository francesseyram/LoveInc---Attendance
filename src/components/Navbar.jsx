import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from '../firebase/auth'
import { useAuth } from '../App'

export default function Navbar() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinks = [
    { to: '/admin',              label: 'Dashboard' },
    { to: '/admin/service/new',  label: 'New Service' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo + Brand */}
          <Link to="/admin" className="flex items-center gap-3 group">
            <img
              src="/global_white_png.png"
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

          {/* Nav Links */}
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

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:block text-brand-subtle text-xs truncate max-w-[200px]">
                {user.email}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="btn-ghost text-sm py-2 px-4"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
