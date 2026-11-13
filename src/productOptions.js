export const PRODUCT_SIZE_OPTIONS = ['Talle único', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
export const PRODUCT_NUMERIC_SIZE_OPTIONS = ['1', '2', '3', '4', '5', '6']

export const PRODUCT_COLOR_OPTIONS = [
  { name: 'Blanco', value: '#f8f7f4' },
  { name: 'Negro', value: '#1b1b1b' },
  { name: 'Gris', value: '#9d9b95' },
  { name: 'Beige', value: '#d9cdbd' },
  { name: 'Marrón', value: '#78594a' },
  { name: 'Bordó', value: '#7c3541' },
  { name: 'Rosa', value: '#e9a5b2' },
  { name: 'Azul', value: '#2d5c8a' },
  { name: 'Verde', value: '#627a62' },
  { name: 'Amarillo', value: '#e4bd31' },
]

function text(value, maximum = 40) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maximum)
}

function key(value) {
  return text(value).toLocaleLowerCase('es-AR')
}

function unique(values) {
  const seen = new Set()
  return values.filter((value) => {
    const valueKey = key(typeof value === 'string' ? value : value?.name)
    if (!valueKey || seen.has(valueKey)) return false
    seen.add(valueKey)
    return true
  })
}

export function normalizeProductSizes(value) {
  if (!Array.isArray(value)) return []
  return unique(value.map((size) => text(size, 20)).filter(Boolean))
}

export function normalizeProductColors(value) {
  if (!Array.isArray(value)) return []
  const colors = value.map((color) => {
    const name = text(typeof color === 'string' ? color : color?.name, 30)
    const preset = PRODUCT_COLOR_OPTIONS.find((item) => key(item.name) === key(name))
    const customValue = text(typeof color === 'object' ? color?.value : '', 7)
    const value = /^#[0-9a-f]{6}$/i.test(customValue) ? customValue : preset?.value || '#77736d'
    return name ? { name, value } : null
  }).filter(Boolean)
  return unique(colors)
}

export function productOptions(product) {
  return {
    sizes: normalizeProductSizes(product?.sizes),
    colors: normalizeProductColors(product?.colors),
  }
}

export function productOptionsSummary(product) {
  const { sizes, colors } = productOptions(product)
  return [
    sizes.length ? `Talles: ${sizes.join(', ')}` : '',
    colors.length ? `Colores: ${colors.map((color) => color.name).join(', ')}` : '',
  ].filter(Boolean).join(' · ')
}
