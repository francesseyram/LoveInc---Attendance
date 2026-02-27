import { Navigate } from 'react-router-dom'
import { useAuth } from '../App'

/**
 * Wraps admin-only routes. Redirects to /login if no authenticated user.
 * Shows a minimal loading state while auth status is resolving.
 */
export default function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-brand-muted text-sm font-body">Authenticating…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
