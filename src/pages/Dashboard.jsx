import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, responderLink } from '../supabaseClient'
import { useAuth } from '../App.jsx'
import { blankStructure } from '../fieldUtils'
import giftTrustBoxStructure, { GIFT_TRUST_BOX_TITLE } from '../templateGiftTrustBox'

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

export default function Dashboard() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { session } = useAuth()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('forms')
      .select('id,title,description,published,created_at,updated_at')
      .order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else setForms(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  async function createForm(title, structure) {
    const { data, error } = await supabase
      .from('forms')
      .insert({
        owner_id: session?.user?.id || null,
        title,
        description: '',
        structure,
        settings: {
          access: 'public',
          acceptingResponses: true,
          confirmationMessage: 'Your response has been recorded.',
        },
        published: false,
      })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/edit/${data.id}`)
  }

  async function deleteForm(id) {
    if (!window.confirm('Delete this form and all its responses?')) return
    await supabase.from('forms').delete().eq('id', id)
    setForms((prev) => prev.filter((f) => f.id !== id))
  }

  async function copyLink(id) {
    const link = responderLink(id)
    try {
      await navigator.clipboard.writeText(link)
      alert('Responder link copied:\n' + link)
    } catch {
      window.prompt('Copy the responder link:', link)
    }
  }

  const visible = useMemo(
    () => forms.filter((f) => f.title.toLowerCase().includes(search.toLowerCase())),
    [forms, search]
  )

  return (
    <div>
      <header className="app-header">
        <div className="brand">
          <span className="logo-mark">▦</span>
          <span>Forms</span>
        </div>
        <div className="search-box">
          <span>🔍</span>
          <input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="header-right">
          <span>{session?.user?.email}</span>
          <button className="btn-outline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="start-section">
        <div className="start-inner">
          <div>Start a new form</div>
          <div className="start-row">
            <button
              className="start-card"
              onClick={() => createForm('Untitled form', blankStructure())}
            >
              <div className="start-thumb">
                <span className="plus-sign">
                  <span className="p1">+</span>
                </span>
              </div>
              <div className="start-label">Blank form</div>
            </button>
            <button
              className="start-card"
              onClick={() => createForm(GIFT_TRUST_BOX_TITLE, giftTrustBoxStructure())}
            >
              <div className="start-thumb">
                <div className="template-thumb">
                  <div className="tt">Gift &amp; Trust Box</div>
                  <div className="line" style={{ width: '45%' }} />
                  <div className="line" style={{ width: '85%' }} />
                  <div className="line" style={{ width: '70%' }} />
                  <div className="line" style={{ width: '85%' }} />
                  <div className="line" style={{ width: '55%' }} />
                </div>
              </div>
              <div className="start-label">Gift &amp; Trust Box Product Inventory</div>
            </button>
          </div>
        </div>
      </section>

      <section className="recent-section">
        <div className="recent-inner">
          <div className="recent-head">
            <div>Recent forms</div>
          </div>
          {error && <div className="field-error">{error}</div>}
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              No forms yet. Select a blank form or a template above to get started.
            </div>
          ) : (
            <div className="forms-grid">
              {visible.map((form) => (
                <div
                  key={form.id}
                  className="form-card"
                  onClick={() => navigate(`/edit/${form.id}`)}
                >
                  <div className="form-card-preview">
                    <div className="pv-card">
                      <div className="line p" style={{ width: '60%' }} />
                      <div className="line" style={{ width: '90%' }} />
                      <div className="line" style={{ width: '75%' }} />
                      <div className="line" style={{ width: '90%' }} />
                      <div className="line" style={{ width: '40%' }} />
                    </div>
                  </div>
                  <div className="form-card-meta">
                    <div className="form-card-title">{form.title}</div>
                    <div className="form-card-sub">
                      <span>Opened {timeAgo(form.updated_at)}</span>
                      <span className={`badge ${form.published ? '' : 'draft'}`}>
                        {form.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="card-menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn"
                      onClick={() => setOpenMenu(openMenu === form.id ? null : form.id)}
                      aria-label="More actions"
                    >
                      ⋮
                    </button>
                    {openMenu === form.id && (
                      <div className="menu-dropdown">
                        <button onClick={() => navigate(`/edit/${form.id}`)}>Open</button>
                        <button onClick={() => copyLink(form.id)}>
                          Copy responder link
                        </button>
                        <button onClick={() => deleteForm(form.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
