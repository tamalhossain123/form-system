import React from 'react'
import { uid } from '../supabaseClient'
import { FIELD_TYPES, CHOICE_TYPES, newField } from '../fieldUtils'

function GotoSelect({ value, sections, onChange }) {
  return (
    <select
      className="select-input option-goto"
      value={value || 'next'}
      onChange={(e) => onChange(e.target.value)}
      title="After this answer, go to"
    >
      <option value="next">Continue to next section</option>
      <option value="submit">Submit form</option>
      {sections.map((s) => (
        <option key={s.id} value={s.id}>
          Go to: {s.title || 'Section'}
        </option>
      ))}
    </select>
  )
}

function StringListEditor({ items, onChange, addLabel }) {
  return (
    <div>
      {(items || []).map((item, i) => (
        <div className="list-edit-row" key={i}>
          <input
            className="bordered-input"
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
          />
          <button
            className="icon-btn"
            onClick={() => onChange(items.filter((_, x) => x !== i))}
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="add-option-btn"
        onClick={() => onChange([...(items || []), `${addLabel} ${(items || []).length + 1}`])}
      >
        + Add {addLabel.toLowerCase()}
      </button>
    </div>
  )
}

export default function FieldEditor({
  field,
  sections,
  onChange,
  onDuplicate,
  onDelete,
  onMove,
  selected,
  onSelect,
  inPair,
}) {
  const patch = (p) => onChange({ ...field, ...p })

  function renderBody() {
    if (CHOICE_TYPES.includes(field.type)) {
      const options = field.options || []
      const showGoto = field.type === 'multiple_choice' || field.type === 'dropdown'
      return (
        <div>
          {options.map((opt) => (
            <div className="option-edit-row" key={opt.id}>
              <span className="radio-dot">
                {field.type === 'checkboxes' ? '☑' : field.type === 'dropdown' ? '•' : '○'}
              </span>
              <input
                type="text"
                value={opt.label}
                onChange={(e) =>
                  patch({
                    options: options.map((o) =>
                      o.id === opt.id ? { ...o, label: e.target.value } : o
                    ),
                  })
                }
              />
              {showGoto && (
                <GotoSelect
                  value={opt.goto}
                  sections={sections}
                  onChange={(goto) =>
                    patch({
                      options: options.map((o) => (o.id === opt.id ? { ...o, goto } : o)),
                    })
                  }
                />
              )}
              <button
                className="icon-btn"
                onClick={() => patch({ options: options.filter((o) => o.id !== opt.id) })}
                title="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="add-option-btn"
            onClick={() =>
              patch({
                options: [...options, { id: uid(), label: `Option ${options.length + 1}` }],
              })
            }
          >
            Add option
          </button>
        </div>
      )
    }

    switch (field.type) {
      case 'short_text':
        return <div className="muted">Short answer text</div>
      case 'paragraph':
        return <div className="muted">Long answer text</div>
      case 'date':
        return <div className="muted">Month, day, year</div>
      case 'time':
        return <div className="muted">Time</div>
      case 'file_upload':
        return <div className="muted">Responders can upload one file (stored in Supabase Storage)</div>
      case 'linear_scale':
        return (
          <div className="scale-edit">
            <label>
              From
              <select
                className="bordered-input"
                value={field.scaleMin ?? 1}
                onChange={(e) => patch({ scaleMin: Number(e.target.value) })}
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </label>
            <label>
              To
              <select
                className="bordered-input"
                value={field.scaleMax ?? 5}
                onChange={(e) => patch({ scaleMax: Number(e.target.value) })}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label for {field.scaleMin ?? 1} (optional)
              <input
                className="bordered-input"
                value={field.scaleMinLabel || ''}
                onChange={(e) => patch({ scaleMinLabel: e.target.value })}
              />
            </label>
            <label>
              Label for {field.scaleMax ?? 5} (optional)
              <input
                className="bordered-input"
                value={field.scaleMaxLabel || ''}
                onChange={(e) => patch({ scaleMaxLabel: e.target.value })}
              />
            </label>
          </div>
        )
      case 'rating':
        return (
          <div className="scale-edit">
            <label>
              Number of stars
              <select
                className="bordered-input"
                value={field.scaleMax ?? 5}
                onChange={(e) => patch({ scaleMax: Number(e.target.value) })}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )
      case 'mc_grid':
      case 'checkbox_grid':
        return (
          <div className="grid-edit-cols">
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>Rows</div>
              <StringListEditor
                items={field.rows || []}
                onChange={(rows) => patch({ rows })}
                addLabel="Row"
              />
            </div>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>Columns</div>
              <StringListEditor
                items={field.columns || []}
                onChange={(columns) => patch({ columns })}
                addLabel="Column"
              />
            </div>
          </div>
        )
      case 'product_quantity':
        return (
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Each product gets a checkbox and a quantity box <strong>beside</strong> its name.
            </div>
            <StringListEditor
              items={field.products || []}
              onChange={(products) => patch({ products })}
              addLabel="Product"
            />
          </div>
        )
      case 'image_block':
        return (
          <div>
            <input
              className="bordered-input"
              placeholder="Image URL (https://...)"
              value={field.imageUrl || ''}
              onChange={(e) => patch({ imageUrl: e.target.value })}
            />
            {field.imageUrl && (
              <img
                src={field.imageUrl}
                alt=""
                style={{ maxWidth: '100%', marginTop: 10, borderRadius: 4 }}
              />
            )}
          </div>
        )
      case 'text_block':
        return <div className="muted">Text only. Responders see the title and description above; there is nothing to answer.</div>
      default:
        return null
    }
  }

  return (
    <div
      className={`card field-card ${selected ? 'selected' : ''} ${inPair ? 'in-pair' : ''}`}
      onClick={onSelect}
    >
      <div className="field-top">
        <input
          className="field-title-input"
          placeholder={field.type === 'text_block' ? 'Text heading' : 'Question'}
          value={field.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <select
          className="bordered-input field-type-select"
          value={field.type}
          onChange={(e) => {
            const type = e.target.value
            // Rebuild type-specific defaults while keeping title/description.
            const fresh = newField(type)
            onChange({
              ...fresh,
              id: field.id,
              title: field.title,
              description: field.description,
              required: field.required,
              pairNext: field.pairNext,
            })
          }}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        className="field-desc-input"
        placeholder="Description (optional)"
        value={field.description || ''}
        onChange={(e) => patch({ description: e.target.value })}
      />
      <div className="field-body-edit">{renderBody()}</div>
      <div className="field-footer">
        <button className="icon-btn" title="Move up" onClick={(e) => { e.stopPropagation(); onMove(-1) }}>↑</button>
        <button className="icon-btn" title="Move down" onClick={(e) => { e.stopPropagation(); onMove(1) }}>↓</button>
        <span className="spacer" />
        <button className="icon-btn" title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate() }}>⧉</button>
        <button className="icon-btn" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }}>🗑</button>
        {field.type !== 'text_block' && field.type !== 'image_block' && (
          <label className="toggle-wrap">
            Required
            <span className="switch">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => patch({ required: e.target.checked })}
              />
              <span className="track" />
            </span>
          </label>
        )}
        <label className="toggle-wrap" title="Render the next field in the same row, beside this one">
          Beside next field
          <span className="switch">
            <input
              type="checkbox"
              checked={!!field.pairNext}
              onChange={(e) => patch({ pairNext: e.target.checked })}
            />
            <span className="track" />
          </span>
        </label>
      </div>
    </div>
  )
}
