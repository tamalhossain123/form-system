import { uid } from './supabaseClient'

export const FIELD_TYPES = [
  { value: 'short_text', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'file_upload', label: 'File upload' },
  { value: 'linear_scale', label: 'Linear scale' },
  { value: 'rating', label: 'Rating' },
  { value: 'mc_grid', label: 'Multiple choice grid' },
  { value: 'checkbox_grid', label: 'Checkbox grid' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'product_quantity', label: 'Product + quantity (beside)' },
  { value: 'text_block', label: 'Text block' },
  { value: 'image_block', label: 'Image block' },
]

export const CHOICE_TYPES = ['multiple_choice', 'checkboxes', 'dropdown']

export function typeLabel(type) {
  const t = FIELD_TYPES.find((x) => x.value === type)
  return t ? t.label : type
}

export function newField(type = 'multiple_choice') {
  const f = {
    id: uid(),
    type,
    title: type === 'text_block' ? '' : 'Untitled Question',
    description: '',
    required: false,
  }
  if (CHOICE_TYPES.includes(type)) {
    f.options = [{ id: uid(), label: 'Option 1' }]
  }
  if (type === 'linear_scale') {
    f.scaleMin = 1
    f.scaleMax = 5
    f.scaleMinLabel = ''
    f.scaleMaxLabel = ''
  }
  if (type === 'rating') {
    f.scaleMax = 5
  }
  if (type === 'mc_grid' || type === 'checkbox_grid') {
    f.rows = ['Row 1']
    f.columns = ['Column 1']
  }
  if (type === 'product_quantity') {
    f.products = ['Product 1']
  }
  if (type === 'image_block') {
    f.imageUrl = ''
  }
  return f
}

export function newSection(title = '') {
  return { id: uid(), title, description: '', afterSection: 'next', fields: [] }
}

export function blankStructure() {
  const s = newSection('')
  s.fields = [newField('multiple_choice')]
  return { sections: [s] }
}

/** All fields of a form, flattened with their section, in display order. */
export function flattenFields(structure) {
  const out = []
  ;(structure?.sections || []).forEach((section) => {
    ;(section.fields || []).forEach((field) => out.push({ field, section }))
  })
  return out
}

export function isEmptyAnswer(field, value) {
  if (value === undefined || value === null) return true
  switch (field.type) {
    case 'text_block':
    case 'image_block':
      return true // never required, nothing to answer
    case 'checkboxes':
      return !Array.isArray(value) || value.length === 0
    case 'mc_grid':
    case 'checkbox_grid':
      return !value || Object.keys(value).length === 0
    case 'product_quantity':
      return (
        !value ||
        !Object.values(value).some((p) => p && p.checked)
      )
    default:
      return value === '' || (typeof value === 'number' && Number.isNaN(value))
  }
}

/** Plain-text rendering of one answer (tables, CSV, summaries). */
export function formatAnswer(field, value) {
  if (value === undefined || value === null || value === '') return ''
  switch (field.type) {
    case 'checkboxes':
      return Array.isArray(value) ? value.join(', ') : String(value)
    case 'mc_grid':
      return Object.entries(value)
        .map(([row, col]) => `${row}: ${col}`)
        .join('; ')
    case 'checkbox_grid':
      return Object.entries(value)
        .map(([row, cols]) => `${row}: ${(cols || []).join(', ')}`)
        .join('; ')
    case 'product_quantity':
      return Object.entries(value)
        .filter(([, p]) => p && p.checked)
        .map(([name, p]) => `${name}: ${p.qty || ''}`.trim())
        .join('; ')
    default:
      return String(value)
  }
}

export function parseQty(qty) {
  if (qty === undefined || qty === null) return 0
  const n = parseFloat(String(qty).replace(/[^0-9.]/g, ''))
  return Number.isNaN(n) ? 0 : n
}
