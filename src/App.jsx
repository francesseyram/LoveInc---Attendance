import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChange } from './firebase/auth'
import { getMemberByEmail, ensureMemberForAuthUser } from './firebase/members'

import CheckIn       from './pages/CheckIn'
import Login         from './pages/Login'
import Admin         from './pages/Admin'
import NewService    from './pages/NewService'
import MemberProfile from './pages/MemberProfile'
import ProtectedRoute from './components/ProtectedRoute'

// ─── Auth Context ─────────────────────────────────────────────
export const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [memberRole,  setMemberRole]  = useState(null) // role of the signed-in admin

  useEffect(() => {
    const unsub = onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser?.email) {
        // Match Auth → members collection (create row if missing — e.g. admin-only Auth users)
        let m = await getMemberByEmail(firebaseUser.email)
        if (!m) {
          try {
            m = await ensureMemberForAuthUser(firebaseUser)
          } catch (e) {
            console.error('Could not sync member record for signed-in user:', e)
          }
        }
        setMemberRole(m?.role ?? null)
      } else {
        setMemberRole(null)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, authLoading, memberRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Theme Context ─────────────────────────────────────────────
export const ThemeContext = createContext(null)
export function useTheme() { return useContext(ThemeContext) }

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('lig-theme') || 'light'   // default = light
  })

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
    }
    localStorage.setItem('lig-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/checkin"           element={<CheckIn />} />
            <Route path="/login"             element={<Login />} />
            <Route path="/admin"             element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin/service/new" element={<ProtectedRoute><NewService /></ProtectedRoute>} />
            <Route path="/admin/members/:id" element={<ProtectedRoute><MemberProfile /></ProtectedRoute>} />
            <Route path="/"  element={<Navigate to="/checkin" replace />} />
            <Route path="*"  element={<Navigate to="/checkin" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
