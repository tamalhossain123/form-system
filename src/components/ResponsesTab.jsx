import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { flattenFields, formatAnswer, parseQty, CHOICE_TYPES } from '../fieldUtils'

function csvEscape(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export default function ResponsesTab({ form, structure }) {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('summary')
  const [questionFieldId, setQuestionFieldId] = useState('')
  const [individualIdx, setIndividualIdx] = useState(0)

  const fields = useMemo(() => flattenFields(structure).map((x) => x.field), [structure])
  const answerFields = useMemo(
    () => fields.filter((f) => f.type !== 'text_block' && f.type !== 'image_block'),
    [fields]
  )

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('responses')
      .select('*')
      .eq('form_id', form.id)
      .order('submitted_at', { ascending: true })
    setResponses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id])

  useEffect(() => {
    if (!questionFieldId && answerFields.length) setQuestionFieldId(answerFields[0].id)
  }, [answerFields, questionFieldId])

  function exportCsv() {
    const header = ['Submitted at', 'Respondent email', ...answerFields.map((f) => f.title || '(untitled)')]
    const lines = [header.map(csvEscape).join(',')]
    responses.forEach((r) => {
      const row = [
        new Date(r.submitted_at).toISOString(),
        r.respondent_email || '',
        ...answerFields.map((f) => formatAnswer(f, r.answers?.[f.id])),
      ]
      lines.push(row.map(csvEscape).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.title.replace(/[^\w\- ]+/g, '').trim() || 'form'}-responses.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteResponse(id) {
    if (!window.confirm('Delete this response?')) return
    await supabase.from('responses').delete().eq('id', id)
    setResponses((prev) => prev.filter((r) => r.id !== id))
    setIndividualIdx((i) => Math.max(0, i - 1))
  }

  if (loading) return <div className="card">Loading responses...</div>

  return (
    <div>
      <div className="card">
        <div className="responses-head">
          <h2>
            {responses.length} response{responses.length === 1 ? '' : 's'}
          </h2>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn-outline" onClick={load}>Refresh</button>
          <button className="btn" onClick={exportCsv} disabled={responses.length === 0}>
            Export CSV
          </button>
        </div>
        <div className="view-switch">
          {['summary', 'question', 'individual', 'table'].map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {responses.length === 0 && (
          <p className="muted">No responses yet. Publish the form and share its link to start accepting responses.</p>
        )}

        {view === 'summary' && responses.length > 0 && (
          <div>
            {answerFields.map((f) => (
              <SummaryField key={f.id} field={f} responses={responses} />
            ))}
          </div>
        )}

        {view === 'question' && responses.length > 0 && (
          <div>
            <select
              className="bordered-input"
              style={{ maxWidth: 420 }}
              value={questionFieldId}
              onChange={(e) => setQuestionFieldId(e.target.value)}
            >
              {answerFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title || '(untitled)'}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 16 }}>
              {responses.map((r) => {
                const f = answerFields.find((x) => x.id === questionFieldId)
                const text = f ? formatAnswer(f, r.answers?.[f.id]) : ''
                return text ? (
                  <div key={r.id} className="answer-chip">{text}</div>
                ) : null
              })}
            </div>
          </div>
        )}

        {view === 'individual' && responses.length > 0 && (
          <IndividualView
            response={responses[Math.min(individualIdx, responses.length - 1)]}
            index={Math.min(individualIdx, responses.length - 1)}
            total={responses.length}
            fields={answerFields}
            onPrev={() => setIndividualIdx((i) => Math.max(0, i - 1))}
            onNext={() => setIndividualIdx((i) => Math.min(responses.length - 1, i + 1))}
            onDelete={deleteResponse}
          />
        )}

        {view === 'table' && responses.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  {answerFields.map((f) => (
                    <th key={f.id}>{f.title || '(untitled)'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.submitted_at).toLocaleString()}</td>
                    {answerFields.map((f) => (
                      <td key={f.id}>{formatAnswer(f, r.answers?.[f.id])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryField({ field, responses }) {
  const values = responses
    .map((r) => r.answers?.[field.id])
    .filter((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))

  let body = null

  if (field.type === 'product_quantity') {
    const totals = {}
    ;(field.products || []).forEach((p) => (totals[p] = { count: 0, qty: 0 }))
    responses.forEach((r) => {
      const ans = r.answers?.[field.id] || {}
      Object.entries(ans).forEach(([name, entry]) => {
        if (entry && entry.checked) {
          if (!totals[name]) totals[name] = { count: 0, qty: 0 }
          totals[name].count += 1
          totals[name].qty += parseQty(entry.qty)
        }
      })
    })
    body = (
      <div>
        {Object.entries(totals).map(([name, t]) => (
          <div className="pq-summary-row" key={name}>
            <span>{name}</span>
            <span className="muted">
              selected {t.count}× · total qty {t.qty}
            </span>
          </div>
        ))}
      </div>
    )
  } else if (CHOICE_TYPES.includes(field.type)) {
    const counts = {}
    values.forEach((v) => {
      const labels = Array.isArray(v) ? v : [v]
      labels.forEach((l) => (counts[l] = (counts[l] || 0) + 1))
    })
    const total = responses.length
    body = (
      <div>
        {(field.options || []).map((opt) => {
          const c = counts[opt.label] || 0
          const pct = total ? Math.round((c / total) * 100) : 0
          return (
            <div className="bar-row" key={opt.id}>
              <span className="bar-label">{opt.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span>
                {c} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    )
  } else if (field.type === 'linear_scale' || field.type === 'rating') {
    const counts = {}
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1))
    const total = responses.length
    body = (
      <div>
        {Object.keys(counts)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => {
            const pct = total ? Math.round((counts[k] / total) * 100) : 0
            return (
              <div className="bar-row" key={k}>
                <span className="bar-label">{k}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span>
                  {counts[k]} ({pct}%)
                </span>
              </div>
            )
          })}
      </div>
    )
  } else {
    body = (
      <div>
        {values.length === 0 && <p className="muted">No answers</p>}
        {values.map((v, i) => (
          <div key={i} className="answer-chip">
            {formatAnswer(field, v)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="summary-field" style={{ padding: '14px 0', borderBottom: '1px solid #f1f3f4' }}>
      <h4>{field.title || '(untitled)'}</h4>
      <div className="resp-count">
        {values.length} response{values.length === 1 ? '' : 's'}
      </div>
      {body}
    </div>
  )
}

function IndividualView({ response, index, total, fields, onPrev, onNext, onDelete }) {
  if (!response) return null
  return (
    <div>
      <div className="individual-nav no-print">
        <button className="icon-btn" onClick={onPrev} disabled={index === 0}>‹</button>
        <span>
          {index + 1} of {total}
        </span>
        <button className="icon-btn" onClick={onNext} disabled={index >= total - 1}>›</button>
        <span className="muted" style={{ marginLeft: 8 }}>
          Submitted {new Date(response.submitted_at).toLocaleString()}
          {response.respondent_email ? ` · ${response.respondent_email}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn-outline" onClick={() => window.print()}>Print</button>
        <button className="btn-outline btn-danger" onClick={() => onDelete(response.id)}>
          Delete
        </button>
      </div>
      {fields.map((f) => {
        const text = formatAnswer(f, response.answers?.[f.id])
        return (
          <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f3f4' }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
              {f.title || '(untitled)'}
            </div>
            <div>{text || <span className="muted">(no answer)</span>}</div>
          </div>
        )
      })}
    </div>
  )
}
