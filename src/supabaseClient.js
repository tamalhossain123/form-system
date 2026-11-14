import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // The app still renders (so the UI can be previewed), but data calls fail.
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase values.'
  )
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
)

export const isConfigured = Boolean(url && anonKey)

/** Absolute responder link for a form, e.g. https://site/app/#/f/<id> */
export function responderLink(formId, token) {
  const base = `${window.location.origin}${window.location.pathname}#/f/${formId}`
  return token ? `${base}?token=${token}` : base
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
