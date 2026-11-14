import React, { useEffect, useState } from 'react'
import { supabase, responderLink } from '../supabaseClient'

export default function RequestsTab({ form }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .eq('form_id', form.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id])

  async function setStatus(id, status) {
    await supabase.from('access_requests').update({ status }).eq('id', id)
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      alert('Access link copied')
    } catch {
      window.prompt('Copy the access link:', text)
    }
  }

  if (loading) return <div className="card">Loading requests...</div>

  return (
    <div className="card">
      <h2 style={{ fontWeight: 400, marginTop: 0 }}>Access requests</h2>
      <p className="muted">
        When this form is set to <strong>Private</strong> (Settings tab), people who open the
        responder link must request access here. Approve a request and send the person their
        personal access link.
      </p>
      {requests.length === 0 && <p className="muted">No requests yet.</p>}
      {requests.map((r) => (
        <div className="request-row" key={r.id}>
          <div className="request-main">
            <div>
              <strong>{r.name || '(no name)'}</strong>{' '}
              <span className="muted">{r.email}</span>{' '}
              <span className={`status-pill status-${r.status}`}>{r.status}</span>
            </div>
            {r.message && <div style={{ marginTop: 4 }}>{r.message}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Requested {new Date(r.created_at).toLocaleString()}
            </div>
            {r.status === 'approved' && (
              <div className="token-link">
                <input
                  className="bordered-input"
                  readOnly
                  value={responderLink(form.id, r.access_token)}
                />
                <button
                  className="btn-outline"
                  onClick={() => copy(responderLink(form.id, r.access_token))}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {r.status !== 'approved' && (
              <button className="btn" onClick={() => setStatus(r.id, 'approved')}>
                Approve
              </button>
            )}
            {r.status !== 'denied' && (
              <button className="btn-outline btn-danger" onClick={() => setStatus(r.id, 'denied')}>
                Deny
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
