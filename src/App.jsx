import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChange } from './firebase/auth'

import CheckIn from './pages/CheckIn'
import Login from './pages/Login'
import Admin from './pages/Admin'
import NewService from './pages/NewService'
import MemberProfile from './pages/MemberProfile'
import ProtectedRoute from './components/ProtectedRoute'

// ─── Auth Context ─────────────────────────────────────────────────────────────
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/login" element={<Login />} />

          {/* Protected admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/service/new"
            element={
              <ProtectedRoute>
                <NewService />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/members/:id"
            element={
              <ProtectedRoute>
                <MemberProfile />
              </ProtectedRoute>
            }
          />

          {/* Catch-all → check-in */}
          <Route path="/" element={<Navigate to="/checkin" replace />} />
          <Route path="*" element={<Navigate to="/checkin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
