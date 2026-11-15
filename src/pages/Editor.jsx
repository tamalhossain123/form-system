import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, responderLink, uid } from '../supabaseClient'
import { newField, newSection, blankStructure } from '../fieldUtils'
import FieldEditor from '../components/FieldEditor.jsx'
import ResponsesTab from '../components/ResponsesTab.jsx'
import RequestsTab from '../components/RequestsTab.jsx'
import SettingsTab from '../components/SettingsTab.jsx'

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [structure, setStructure] = useState(blankStructure())
  const [settings, setSettings] = useState({ access: 'public', acceptingResponses: true, confirmationMessage: '' })
  const [published, setPublished] = useState(false)
  const [tab, setTab] = useState('questions')
  const [saveState, setSaveState] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState('')
  const [notOwner, setNotOwner] = useState(false)
  const loadedRef = useRef(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from('forms').select('*').eq('id', id).single()
      if (error) {
        setError(error.message)
        return
      }
      // Ownership isolation: never open (or autosave) another user's form.
      if (data.owner_id) {
        const { data: sess } = await supabase.auth.getSession()
        const userId = sess?.session?.user?.id || null
        if (data.owner_id !== userId) {
          setNotOwner(true)
          return // loadedRef stays false, so autosave never runs
        }
      }
      setForm(data)
      setTitle(data.title || 'Untitled form')
      setDescription(data.description || '')
      setStructure(data.structure && data.structure.sections ? data.structure : blankStructure())
      setSettings(data.settings || { access: 'public', acceptingResponses: true, confirmationMessage: '' })
      setPublished(!!data.published)
      loadedRef.current = true
    })()
  }, [id])

  async function loadPendingCount() {
    const { count } = await supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', id)
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  useEffect(() => {
    loadPendingCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab])

  // Debounced autosave, Google-style.
  useEffect(() => {
    if (!loadedRef.current) return
    setSaveState('Saving...')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('forms')
        .update({
          title,
          description,
          structure,
          settings,
          published,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      setSaveState(error ? 'Save failed' : 'All changes saved')
    }, 900)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, structure, settings, published])

  const sections = structure.sections || []

  // --- Undo / redo history for the form structure -------------------------
  // past/future hold snapshots of `structure`. Every structure change made
  // through setSections() routes through updateStructure(), which pushes the
  // previous structure onto `past` (capped at 100) and clears `future`.
  // Coalescing: changes arriving within 800ms of the last push skip pushing,
  // so a burst of keystrokes collapses into a single undo step.
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const lastPushRef = useRef(0)

  function updateStructure(next) {
    const now = Date.now()
    if (now - lastPushRef.current >= 800) {
      setPast((p) => [...p.slice(-99), structure])
    }
    lastPushRef.current = now
    setFuture([])
    setStructure(next)
  }

  function undo() {
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((f) => [structure, ...f].slice(0, 100))
    lastPushRef.current = 0 // next edit starts a fresh history step
    setStructure(prev) // flows through the normal setter, so autosave persists it
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast((p) => [...p.slice(-99), structure])
    lastPushRef.current = 0
    setStructure(next)
  }

  // Keep refs to the latest undo/redo for the keyboard handler.
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo

  useEffect(() => {
    function onKey(e) {
      const t = e.target
      const tag = t && t.tagName
      // Inside text fields, let the browser's native text undo happen.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = (e.key || '').toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function setSections(next) {
    updateStructure({ ...structure, sections: next })
  }

  function updateSection(secId, patch) {
    setSections(sections.map((s) => (s.id === secId ? { ...s, ...patch } : s)))
  }

  function targetSectionId() {
    if (selectedFieldId) {
      const owner = sections.find((s) => s.fields.some((f) => f.id === selectedFieldId))
      if (owner) return owner.id
    }
    return sections.length ? sections[sections.length - 1].id : null
  }

  function addField(type) {
    const secId = targetSectionId()
    if (!secId) return
    const f = newField(type)
    setSections(
      sections.map((s) => (s.id === secId ? { ...s, fields: [...s.fields, f] } : s))
    )
    setSelectedFieldId(f.id)
  }

  function addSection() {
    const s = newSection(`Section ${sections.length + 1}`)
    setSections([...sections, s])
  }

  function deleteSection(secId) {
    if (sections.length <= 1) return
    if (!window.confirm('Delete this section and all its questions?')) return
    setSections(sections.filter((s) => s.id !== secId))
  }

  function updateField(secId, fieldId, nextField) {
    setSections(
      sections.map((s) =>
        s.id === secId
          ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? nextField : f)) }
          : s
      )
    )
  }

  function duplicateField(secId, field) {
    const copy = JSON.parse(JSON.stringify(field))
    copy.id = uid()
    copy.title = field.title ? field.title + ' (copy)' : field.title
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s
        const idx = s.fields.findIndex((f) => f.id === field.id)
        const fields = [...s.fields]
        fields.splice(idx + 1, 0, copy)
        return { ...s, fields }
      })
    )
  }

  function deleteField(secId, fieldId) {
    setSections(
      sections.map((s) =>
        s.id === secId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s
      )
    )
  }

  function moveField(secId, fieldId, dir) {
    setSections(
      sections.map((s) => {
        if (s.id !== secId) return s
        const idx = s.fields.findIndex((f) => f.id === fieldId)
        const j = idx + dir
        if (idx < 0 || j < 0 || j >= s.fields.length) return s
        const fields = [...s.fields]
        ;[fields[idx], fields[j]] = [fields[j], fields[idx]]
        return { ...s, fields }
      })
    )
  }

  /** Group fields into rows honouring pairNext (side-by-side). */
  function groupedFields(fields) {
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

  async function copyResponderLink() {
    const link = responderLink(id)
    try {
      await navigator.clipboard.writeText(link)
      alert('Responder link copied:\n' + link)
    } catch {
      window.prompt('Copy the responder link:', link)
    }
  }

  function openPreview() {
    window.open(responderLink(id), '_blank')
  }

  const formForTabs = useMemo(
    () => ({ id, title, published }),
    [id, title, published]
  )

  if (error) {
    return (
      <div className="center-page">
        <div>
          <p className="field-error">{error}</p>
          <button className="btn" onClick={() => navigate('/')}>Back to forms</button>
        </div>
      </div>
    )
  }
  if (notOwner) {
    return (
      <div className="center-page">
        <div>
          <p>This form belongs to another account.</p>
          <button className="btn" onClick={() => navigate('/')}>Back to forms</button>
        </div>
      </div>
    )
  }
  if (!form) return <div className="center-page">Loading...</div>

  return (
    <div>
      <div className="editor-topbar">
        <div className="editor-topbar-row">
          <button className="icon-btn" title="Back to forms" onClick={() => navigate('/')}>▦</button>
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className="save-indicator">{saveState}</span>
          <div className="topbar-actions">
            <button
              className="icon-btn text-btn"
              title="Undo (Ctrl+Z)"
              onClick={undo}
              disabled={past.length === 0}
            >
              ↩ Undo
            </button>
            <button
              className="icon-btn text-btn"
              title="Redo (Ctrl+Shift+Z)"
              onClick={redo}
              disabled={future.length === 0}
            >
              ↪ Redo
            </button>
            <button className="icon-btn" title="Preview" onClick={openPreview}>👁</button>
            <button className="icon-btn" title="Copy responder link" onClick={copyResponderLink}>🔗</button>
            <button
              className="icon-btn"
              title="Sign out"
              onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
            >
              ⏻
            </button>
            <button
              className={`btn publish-btn`}
              onClick={() => setPublished((p) => !p)}
              style={published ? { background: '#fff', color: '#673ab7', border: '1px solid #dadce0' } : {}}
            >
              {published ? 'Published ✓' : 'Publish'}
            </button>
          </div>
        </div>
        <div className="editor-tabs">
          <button className={`editor-tab ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>
            Questions
          </button>
          <button className={`editor-tab ${tab === 'responses' ? 'active' : ''}`} onClick={() => setTab('responses')}>
            Responses
          </button>
          <button className={`editor-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            Requests
            {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
          </button>
          <button className={`editor-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
            Settings
          </button>
        </div>
      </div>

      <div className="editor-body">
        {tab === 'questions' && (
          <>
            <div className="card title-card">
              <input
                className="form-name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Form title"
              />
              <textarea
                rows={1}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form description"
              />
            </div>

            {sections.map((section, sIdx) => (
              <div key={section.id}>
                {(sIdx > 0 || section.title) && (
                  <div className="card section-card">
                    <div className="section-header">
                      <span className="sec-count">
                        Section {sIdx + 1} of {sections.length}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button
                        className="icon-btn"
                        style={{ color: '#fff' }}
                        title="Delete section"
                        onClick={() => deleteSection(section.id)}
                      >
                        🗑
                      </button>
                    </div>
                    <div className="section-body">
                      <input
                        className="section-title-input"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        placeholder="Section title"
                      />
                      <textarea
                        className="section-desc-input"
                        rows={1}
                        value={section.description || ''}
                        onChange={(e) => updateSection(section.id, { description: e.target.value })}
                        placeholder="Section description (optional)"
                      />
                    </div>
                    <div className="section-footer">
                      <span>After section:</span>
                      <select
                        className="bordered-input"
                        value={section.afterSection || 'next'}
                        onChange={(e) => updateSection(section.id, { afterSection: e.target.value })}
                      >
                        <option value="next">Continue to next section</option>
                        <option value="submit">Submit form</option>
                        {sections
                          .filter((s) => s.id !== section.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              Go to: {s.title || 'Section'}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}

                {groupedFields(section.fields).map((group) => (
                  <div key={group.map((f) => f.id).join('-')} className={group.length > 1 ? 'pair-row' : ''}>
                    {group.map((f) => (
                      <FieldEditor
                        key={f.id}
                        field={f}
                        sections={sections}
                        inPair={group.length > 1}
                        selected={selectedFieldId === f.id}
                        onSelect={() => setSelectedFieldId(f.id)}
                        onChange={(next) => updateField(section.id, f.id, next)}
                        onDuplicate={() => duplicateField(section.id, f)}
                        onDelete={() => deleteField(section.id, f.id)}
                        onMove={(dir) => moveField(section.id, f.id, dir)}
                      />
                    ))}
                  </div>
                ))}

                {section.fields.length === 0 && (
                  <div className="card muted" style={{ textAlign: 'center' }}>
                    No questions in this section yet. Use the + button on the right to add one.
                  </div>
                )}
              </div>
            ))}

            <div className="floating-toolbar wrap-fixed">
              <button title="Add question" onClick={() => addField('multiple_choice')}>⊕</button>
              <button title="Add text block" onClick={() => addField('text_block')}>T</button>
              <button title="Add image block" onClick={() => addField('image_block')}>🖼</button>
              <button title="Add section" onClick={addSection}>☰</button>
            </div>
          </>
        )}

        {tab === 'responses' && <ResponsesTab form={formForTabs} structure={structure} />}
        {tab === 'requests' && <RequestsTab form={formForTabs} />}
        {tab === 'settings' && (
          <SettingsTab form={formForTabs} settings={settings} onSettingsChange={setSettings} />
        )}
      </div>
    </div>
  )
}
