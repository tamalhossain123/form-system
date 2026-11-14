import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, isConfigured } from '../supabaseClient'
import { useAuth } from '../App.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

  React.useEffect(() => {
    if (session) navigate(location.state?.from || '/', { replace: true })
  }, [session, navigate, location.state])

  async function handle(e, mode) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice('Account created. If email confirmation is enabled in Supabase, confirm first, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(location.state?.from || '/', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <div className="login-card">
        <div className="logo-mark">▦</div>
        <h1>Sign in</h1>
        <p className="muted">to continue to Forms</p>
        {!isConfigured && (
          <p className="field-error" style={{ textAlign: 'left' }}>
            Supabase is not configured yet. Copy .env.example to .env and add your
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        )}
        <form>
          <input
            className="bordered-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="bordered-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="field-error">{error}</div>}
          {notice && <div className="muted">{notice}</div>}
          <button className="btn" disabled={busy} onClick={(e) => handle(e, 'signin')}>
            {busy ? 'Please wait...' : 'Sign in'}
          </button>
          <button
            className="btn-outline"
            disabled={busy}
            onClick={(e) => handle(e, 'signup')}
          >
            Create owner account
          </button>
        </form>
      </div>
    </div>
  )
}
