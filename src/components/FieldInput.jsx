import React from 'react'
import { supabase } from '../supabaseClient'

/**
 * Renders the answer control for one field in the responder view.
 * Props: field, value, onChange(value), formId
 */
export default function FieldInput({ field, value, onChange, formId }) {
  switch (field.type) {
    case 'text_block':
      return null

    case 'image_block':
      return field.imageUrl ? (
        <img className="field-image" src={field.imageUrl} alt={field.title || 'Form image'} />
      ) : null

    case 'short_text':
      return (
        <input
          className="text-input short"
          type="text"
          placeholder="Your answer"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'paragraph':
      return (
        <textarea
          className="text-input paragraph"
          rows={3}
          placeholder="Your answer"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'multiple_choice':
      return (
        <div className="choice-list">
          {(field.options || []).map((opt) => (
            <label key={opt.id} className="choice-row">
              <input
                type="radio"
                name={field.id}
                checked={value === opt.label}
                onChange={() => onChange(opt.label)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )

    case 'checkboxes':
      return (
        <div className="choice-list">
          {(field.options || []).map((opt) => {
            const arr = Array.isArray(value) ? value : []
            const checked = arr.includes(opt.label)
            return (
              <label key={opt.id} className="choice-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...arr, opt.label]
                        : arr.filter((x) => x !== opt.label)
                    )
                  }
                />
                <span>{opt.label}</span>
              </label>
            )
          })}
        </div>
      )

    case 'dropdown':
      return (
        <select
          className="select-input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose</option>
          {(field.options || []).map((opt) => (
            <option key={opt.id} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      )

    case 'file_upload':
      return (
        <FileUploadInput field={field} value={value} onChange={onChange} formId={formId} />
      )

    case 'linear_scale': {
      const min = field.scaleMin ?? 1
      const max = field.scaleMax ?? 5
      const nums = []
      for (let i = min; i <= max; i++) nums.push(i)
      return (
        <div className="scale-wrap">
          {field.scaleMinLabel && <span className="scale-label">{field.scaleMinLabel}</span>}
          <div className="scale-row">
            {nums.map((n) => (
              <label key={n} className="scale-item">
                <span>{n}</span>
                <input
                  type="radio"
                  name={field.id}
                  checked={value === n}
                  onChange={() => onChange(n)}
                />
              </label>
            ))}
          </div>
          {field.scaleMaxLabel && <span className="scale-label">{field.scaleMaxLabel}</span>}
        </div>
      )
    }

    case 'rating': {
      const max = field.scaleMax ?? 5
      const stars = []
      for (let i = 1; i <= max; i++) stars.push(i)
      return (
        <div className="rating-row">
          {stars.map((n) => (
            <button
              type="button"
              key={n}
              className={`star-btn ${value >= n ? 'filled' : ''}`}
              onClick={() => onChange(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
      )
    }

    case 'mc_grid':
      return (
        <table className="grid-table">
          <thead>
            <tr>
              <th></th>
              {(field.columns || []).map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(field.rows || []).map((row) => (
              <tr key={row}>
                <td className="grid-row-label">{row}</td>
                {(field.columns || []).map((col) => (
                  <td key={col} className="grid-cell">
                    <input
                      type="radio"
                      name={`${field.id}-${row}`}
                      checked={value?.[row] === col}
                      onChange={() => onChange({ ...(value || {}), [row]: col })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'checkbox_grid':
      return (
        <table className="grid-table">
          <thead>
            <tr>
              <th></th>
              {(field.columns || []).map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(field.rows || []).map((row) => (
              <tr key={row}>
                <td className="grid-row-label">{row}</td>
                {(field.columns || []).map((col) => {
                  const rowVals = (value && value[row]) || []
                  const checked = rowVals.includes(col)
                  return (
                    <td key={col} className="grid-cell">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = { ...(value || {}) }
                          next[row] = e.target.checked
                            ? [...rowVals, col]
                            : rowVals.filter((x) => x !== col)
                          onChange(next)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'date':
      return (
        <input
          className="text-input short"
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'time':
      return (
        <input
          className="text-input short"
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'product_quantity': {
      // THE extra feature: product name on the left, quantity box BESIDE it.
      const current = value || {}
      const setProduct = (name, patch) =>
        onChange({ ...current, [name]: { ...(current[name] || { checked: false, qty: '' }), ...patch } })
      return (
        <div className="pq-list">
          {(field.products || []).map((name) => {
            const entry = current[name] || { checked: false, qty: '' }
            return (
              <div key={name} className="pq-row">
                <label className="pq-name">
                  <input
                    type="checkbox"
                    checked={!!entry.checked}
                    onChange={(e) => setProduct(name, { checked: e.target.checked })}
                  />
                  <span>{name}</span>
                </label>
                <input
                  className="text-input pq-qty"
                  type="text"
                  inputMode="decimal"
                  placeholder="কতো গ্রাম / How many grams"
                  value={entry.qty || ''}
                  onChange={(e) =>
                    setProduct(name, { qty: e.target.value, checked: true })
                  }
                />
              </div>
            )
          })}
        </div>
      )
    }

    default:
      return (
        <input
          className="text-input short"
          type="text"
          placeholder="Your answer"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

function FileUploadInput({ field, value, onChange, formId }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const path = `${formId || 'misc'}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('uploads').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setError('Upload failed: ' + (err.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="upload-btn">
        {busy ? 'Uploading...' : 'Add file'}
        <input type="file" hidden onChange={handleFile} disabled={busy} />
      </label>
      {value && (
        <div className="uploaded-file">
          <a href={value} target="_blank" rel="noreferrer">
            {decodeURIComponent(value.split('/').pop() || 'Uploaded file')}
          </a>
          <button type="button" className="link-btn" onClick={() => onChange('')}>
            Remove
          </button>
        </div>
      )}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
