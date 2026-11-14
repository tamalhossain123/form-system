import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function SettingsTab({ form, settings, onSettingsChange }) {
  const navigate = useNavigate()
  const patch = (p) => onSettingsChange({ ...settings, ...p })

  async function deleteForm() {
    if (!window.confirm('Delete this form permanently? All responses will also be deleted.')) return
    const { error } = await supabase.from('forms').delete().eq('id', form.id)
    if (error) {
      alert('Delete failed: ' + error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="card">
      <h2 style={{ fontWeight: 400, marginTop: 0 }}>Settings</h2>

      <div className="settings-row">
        <h4>Who can respond</h4>
        <label className="radio-row">
          <input
            type="radio"
            name="access"
            checked={settings.access !== 'private'}
            onChange={() => patch({ access: 'public' })}
          />
          <span>
            <strong>Public</strong>
            <div className="muted">Anyone with the link can respond.</div>
          </span>
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name="access"
            checked={settings.access === 'private'}
            onChange={() => patch({ access: 'private' })}
          />
          <span>
            <strong>Private</strong>
            <div className="muted">
              Responders must request access first. Only people you approve (Requests tab)
              can open the form, using their personal access link.
            </div>
          </span>
        </label>
      </div>

      <div className="settings-row">
        <h4>Accepting responses</h4>
        <label className="toggle-wrap" style={{ marginLeft: 0 }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={settings.acceptingResponses !== false}
              onChange={(e) => patch({ acceptingResponses: e.target.checked })}
            />
            <span className="track" />
          </span>
          {settings.acceptingResponses !== false
            ? 'This form is accepting responses'
            : 'This form is closed. Responders will see a closed message.'}
        </label>
      </div>

      <div className="settings-row">
        <h4>Confirmation message</h4>
        <p className="muted">Shown to responders after they submit.</p>
        <input
          className="bordered-input"
          value={settings.confirmationMessage || ''}
          onChange={(e) => patch({ confirmationMessage: e.target.value })}
          placeholder="Your response has been recorded."
        />
      </div>

      <div className="settings-row">
        <h4>Danger zone</h4>
        <button className="btn-outline btn-danger" onClick={deleteForm}>
          Delete this form
        </button>
      </div>
    </div>
  )
}
