import React, { createContext, useContext, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Editor from './pages/Editor.jsx'
import Responder from './pages/Responder.jsx'

const AuthContext = createContext({ session: null, loading: true })
export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
  )
}

function Protected({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center-page">Loading...</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/edit/:id"
          element={
            <Protected>
              <Editor />
            </Protected>
          }
        />
        {/* Public responder route - no login needed */}
        <Route path="/f/:id" element={<Responder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
