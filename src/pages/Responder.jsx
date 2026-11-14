import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { isEmptyAnswer } from '../fieldUtils'
import FieldInput from '../components/FieldInput.jsx'

export default function Responder() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [form, setForm] = useState(null)
  const [state, setState] = useState('loading') // loading | notfound | private | ready | closed
  const [accessRequest, setAccessRequest] = useState(null)
  const [isOwnerPreview, setIsOwnerPreview] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('forms').select('*').eq('id', id).single()
      if (!data) {
        setState('notfound')
        return
      }
      setForm(data)
      const settings = data.settings || {}

      if (!data.published) {
        const { data: sess } = await supabase.auth.getSession()
        if (!sess.session) {
          setState('notfound')
          return
        }
        setIsOwnerPreview(true)
      }

      if (settings.access === 'private') {
        if (!token) {
          setState('private')
          return
        }
        const { data: req } = await supabase
          .from('access_requests')
          .select('*')
          .eq('form_id', id)
          .eq('access_token', token)
          .eq('status', 'approved')
          .maybeSingle()
        if (!req) {
          setState('private')
          return
        }
        setAccessRequest(req)
      }

      if (settings.acceptingResponses === false && !isOwnerPreview) {
        // Owner preview check needs the session result; re-check quickly:
        const { data: sess } = await supabase.auth.getSession()
        if (!sess.session) {
          setState('closed')
          return
        }
      }
      setState('ready')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token])

  if (state === 'loading') return <div className="center-page">Loading...</div>
  if (state === 'notfound') {
    return (
      <div className="respond-wrap">
        <div className="card respond-title-card">
          <h1>Form not available</h1>
          <p>This form does not exist or has not been published yet.</p>
        </div>
      </div>
    )
  }
  if (state === 'private') return <AccessGate form={form} />
  if (state === 'closed') {
    return (
      <div className="respond-wrap">
        <div className="card respond-title-card">
          <h1>{form.title}</h1>
          <p>This form is no longer accepting responses.</p>
        </div>
      </div>
    )
  }
  return (
    <FillForm
      form={form}
      accessRequest={accessRequest}
      isOwnerPreview={isOwnerPreview}
    />
  )
}

/* ------------------------- private access gate ------------------------- */

function AccessGate({ form }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState('')
  const [checkMsg, setCheckMsg] = useState('')

  async function requestAccess(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.from('access_requests').insert({
      form_id: form.id,
      name,
      email,
      message,
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function checkApproval(e) {
    e.preventDefault()
    setCheckMsg('')
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .eq('form_id', form.id)
      .ilike('email', checkEmail.trim())
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length) {
      navigate(`/f/${form.id}?token=${data[0].access_token}`, { replace: true })
    } else {
      setCheckMsg('No approved request found for that email yet.')
    }
  }

  return (
    <div className="respond-wrap">
      <div className="card respond-title-card">
        <h1>{form.title}</h1>
        {form.description && <p>{form.description}</p>}
      </div>
      <div className="card">
        {sent ? (
          <>
            <h3 style={{ marginTop: 0 }}>Request sent</h3>
            <p className="muted">
              Your request has been sent to the form owner. Once it is approved, you will be
              able to open this form with your personal access link. If you were already
              approved, use the email check below.
            </p>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>This form is private</h3>
            <p className="muted">Request access to fill in this form.</p>
            <form onSubmit={requestAccess} style={{ display: 'grid', gap: 14 }}>
              <input
                className="bordered-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="bordered-input"
                type="email"
                placeholder="Your email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <textarea
                className="bordered-input"
                rows={3}
                placeholder="Message (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <div className="field-error">{error}</div>}
              <div>
                <button className="btn" disabled={busy}>
                  {busy ? 'Sending...' : 'Request access'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Already approved?</h3>
        <p className="muted">Enter your email to open your personal access link.</p>
        <form onSubmit={checkApproval} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="bordered-input"
            style={{ flex: 1, minWidth: 220 }}
            type="email"
            placeholder="Your email"
            required
            value={checkEmail}
            onChange={(e) => setCheckEmail(e.target.value)}
          />
          <button className="btn-outline">Check</button>
        </form>
        {checkMsg && <div className="field-error">{checkMsg}</div>}
      </div>
    </div>
  )
}

/* ------------------------------ fill form ------------------------------ */

function FillForm({ form, accessRequest, isOwnerPreview }) {
  const sections = useMemo(() => form.structure?.sections || [], [form])
  const settings = form.settings || {}
  const storageKey = `fs-progress-${form.id}`

  const [answers, setAnswers] = useState({})
  const [page, setPage] = useState(0) // section index, or 'submit'
  const [history, setHistory] = useState([])
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const restoredRef = useRef(false)

  // Restore autosaved progress (like Google Forms).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.answers && Object.keys(saved.answers).length > 0) {
          setAnswers(saved.answers)
          if (typeof saved.page === 'number') setPage(saved.page)
          setToast('Your progress has been restored')
          setTimeout(() => setToast(''), 4000)
        }
      }
    } catch {
      /* ignore */
    }
    restoredRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restoredRef.current || submitted) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, page }))
    } catch {
      /* ignore */
    }
  }, [answers, page, storageKey, submitted])

  const currentSection = typeof page === 'number' ? sections[page] : null

  function setAnswer(fieldId, value) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
    setErrors((prev) => ({ ...prev, [fieldId]: undefined }))
  }

  function validateSection(section) {
    const errs = {}
    ;(section.fields || []).forEach((f) => {
      if (f.required && isEmptyAnswer(f, answers[f.id])) {
        errs[f.id] = 'This is a required question'
      }
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /** Work out where "Next" goes: option-level goto beats section navigation. */
  function computeTarget(section, sectionIdx) {
    for (const f of section.fields || []) {
      if (f.type === 'dropdown' || f.type === 'multiple_choice') {
        const chosen = (f.options || []).find((o) => o.label === answers[f.id])
        if (chosen && chosen.goto && chosen.goto !== 'next') return chosen.goto
      }
    }
    const after = section.afterSection || 'next'
    if (after !== 'next') return after
    return sectionIdx + 1 < sections.length ? sections[sectionIdx + 1].id : 'submit'
  }

  function goNext() {
    if (!currentSection) return
    if (!validateSection(currentSection)) return
    const target = computeTarget(currentSection, page)
    setHistory((h) => [...h, page])
    if (target === 'submit') {
      setPage('submit')
    } else {
      const idx = sections.findIndex((s) => s.id === target)
      setPage(idx >= 0 ? idx : 'submit')
    }
    window.scrollTo({ top: 0 })
  }

  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h
      setPage(h[h.length - 1])
      return h.slice(0, -1)
    })
    window.scrollTo({ top: 0 })
  }

  function clearForm() {
    if (!window.confirm('Clear all your answers?')) return
    setAnswers({})
    setErrors({})
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }

  async function submit() {
    // Validate every section before submitting.
    for (const section of sections) {
      const bad = (section.fields || []).some(
        (f) => f.required && isEmptyAnswer(f, answers[f.id])
      )
      if (bad) {
        alert('Some required questions are still unanswered. Please go back and complete them.')
        return
      }
    }
    setSubmitting(true)
    const { error } = await supabase.from('responses').insert({
      form_id: form.id,
      answers,
      respondent_email: accessRequest?.email || null,
    })
    setSubmitting(false)
    if (error) {
      alert('Could not submit: ' + error.message)
      return
    }
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
    setSubmitted(true)
    window.scrollTo({ top: 0 })
  }

  function submitAnother() {
    setAnswers({})
    setHistory([])
    setPage(0)
    setSubmitted(false)
  }

  /** Group a section's fields into rows using pairNext (side-by-side). */
  function grouped(fields) {
    const groups = []
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].pairNext && i + 1 < fields.length) {
        groups.push([fields[i], fields[i + 1]])
        i++
      } else {
        groups.push([fields[i]])
      }
    }
    return groups
  }

  function renderField(f) {
    const err = errors[f.id]
    return (
      <div key={f.id} className={`card respond-field ${err ? 'error' : ''}`}>
        {f.type !== 'image_block' && f.title && (
          <h3>
            {f.title}
            {f.required && <span className="req"> *</span>}
          </h3>
        )}
        {f.description && <p className="f-desc">{f.description}</p>}
        <FieldInput field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} formId={form.id} />
        {err && <div className="field-error">⚠ {err}</div>}
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="respond-wrap">
        <div className="card respond-title-card">
          <h1>{form.title}</h1>
          <p>{settings.confirmationMessage || 'Your response has been recorded.'}</p>
          <p style={{ marginTop: 16 }}>
            <button className="link-btn" onClick={submitAnother}>
              Submit another response
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="respond-wrap">
      {isOwnerPreview && (
        <div className="card" style={{ background: '#fef7e0', borderColor: '#f9ab78' }}>
          Preview mode: this form is not published yet. Only you can see it because you are signed in.
        </div>
      )}

      {page !== 'submit' && currentSection && (
        <>
          {page === 0 && (
            <div className="card respond-title-card">
              <h1>{form.title}</h1>
              {form.description && <p>{form.description}</p>}
              {sections.some((s) => s.fields.some((f) => f.required)) && (
                <div className="required-note">* Indicates required question</div>
              )}
            </div>
          )}
          {currentSection.title && (
            <div className="card" style={{ background: '#673ab7', color: '#fff', padding: '14px 24px' }}>
              <div style={{ fontSize: 18 }}>{currentSection.title}</div>
              {currentSection.description && (
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{currentSection.description}</div>
              )}
            </div>
          )}

          {grouped(currentSection.fields || []).map((group) =>
            group.length > 1 ? (
              <div key={group.map((f) => f.id).join('-')} className="pair-fields">
                {group.map((f) => (
                  <div key={f.id} className="respond-field-wrap" style={{ flex: 1, minWidth: 0 }}>
                    {renderField(f)}
                  </div>
                ))}
              </div>
            ) : (
              renderField(group[0])
            )
          )}

          <div className="respond-nav">
            {history.length > 0 && (
              <button className="btn-outline" onClick={goBack}>
                Back
              </button>
            )}
            <button className="btn" onClick={goNext}>
              Next
            </button>
            <span className="spacer" />
            <button className="clear-form-btn" onClick={clearForm}>
              Clear form
            </button>
          </div>
        </>
      )}

      {page === 'submit' && (
        <>
          <div className="card respond-title-card">
            <h1>{form.title}</h1>
            <p>Review your answers and press Submit to finish.</p>
          </div>
          <div className="respond-nav">
            <button className="btn-outline" onClick={goBack}>
              Back
            </button>
            <button className="btn" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <span className="spacer" />
            <button className="clear-form-btn" onClick={clearForm}>
              Clear form
            </button>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
