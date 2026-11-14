// Template: "Gift & Trust Box Product Inventory"
// Faithful recreation of Tamal's real Google Form, verified field by field
// against the original (including its quirks, noted inline).

let counter = 0
function fid() {
  counter += 1
  return `tpl-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

function field(type, title, extra = {}) {
  return {
    id: fid(),
    type,
    title,
    description: '',
    required: false,
    ...extra,
  }
}

function option(label, goto) {
  return { id: fid(), label, ...(goto ? { goto } : {}) }
}

const PRODUCTS = [
  'Shorer Ghee',
  'Noni Ghee',
  'A2 Ghee',
  'Black seed Honey',
  'Sundarbans Honey',
  'Natural Honey',
  'Maghi Mustard Oil',
  'Coconut Oil',
  'Chili Powder',
  'Turmeric Powder',
  'Coriander Powder',
  'Cumin Powder',
]

// In the original form the per-product quantity fields appear in this order
// (Coriander before Turmeric, and NO Cumin Powder quantity field at all).
const QUANTITY_ORDER = [
  'Shorer Ghee',
  'Noni Ghee',
  'A2 Ghee',
  'Black seed Honey',
  'Sundarbans Honey',
  'Natural Honey',
  'Maghi Mustard Oil',
  'Coconut Oil',
  'Chili Powder',
  'Coriander Powder',
  'Turmeric Powder',
]

export function giftTrustBoxStructure() {
  const consumerSectionId = 'section-consumer-gift'
  const trustSectionId = 'section-trust-box-gift'

  return {
    sections: [
      {
        id: 'section-page-1',
        title: '',
        description: '',
        afterSection: 'next',
        fields: [
          field('date', 'Date', { required: true }),
          field('dropdown', 'Purpose', {
            required: true,
            options: [
              option('Consumer Gift (Trust Box)', consumerSectionId),
              option('Trust Box Gift', trustSectionId),
              // In the original, "Gift Product" submits right away.
              option('Gift Product', 'submit'),
            ],
          }),
        ],
      },
      {
        id: consumerSectionId,
        title: 'Consumer Gift (Trust Box)',
        description: '',
        afterSection: 'submit',
        fields: [
          field('short_text', 'Consumer Name'),
          field('short_text', 'Authorise Person'),
          // The whole point of this system: the quantity box sits BESIDE
          // each product name instead of being a separate question below.
          field('product_quantity', 'Product Name', { products: [...PRODUCTS] }),
          field('short_text', 'Address'),
          field('short_text', 'Box Number'),
        ],
      },
      {
        id: trustSectionId,
        title: 'Trust Box Gift',
        description: '',
        afterSection: 'submit',
        fields: [
          field('short_text', 'Consumer Name'),
          field('short_text', 'Authorise Person'),
          field('dropdown', 'Product Name', {
            options: PRODUCTS.map((p) => option(p)),
          }),
          // Original has one separate quantity question per product,
          // in QUANTITY_ORDER, and no Cumin Powder question (faithful copy).
          ...QUANTITY_ORDER.map((p) => field('short_text', p)),
          field('short_text', 'Address'),
          field('short_text', 'Box Number'),
        ],
      },
    ],
  }
}

export const GIFT_TRUST_BOX_TITLE = 'Gift & Trust Box Product Inventory'

export default giftTrustBoxStructure
