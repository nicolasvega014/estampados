export const DEFAULT_PRODUCT_TYPES = Object.freeze([
  { id: 'remeras', name: 'Remeras' },
  { id: 'remerones', name: 'Remerones' },
  { id: 'camperas', name: 'Camperas' },
  { id: 'pantalones', name: 'Pantalones' },
])

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40)
}

function cleanId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
}

export function productTypeSlug(value) {
  const base = cleanName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base.slice(0, 36)
}

export function normalizeProductTypes(value) {
  if (!Array.isArray(value)) return []

  const ids = new Set()
  return value.reduce((types, item) => {
    const name = cleanName(item?.name)
    const id = cleanId(item?.id) || productTypeSlug(name)
    if (!name || !id || ids.has(id)) return types
    ids.add(id)
    types.push({ id, name })
    return types
  }, [])
}

export function catalogProductTypes(value, useDefaults = true) {
  const types = normalizeProductTypes(value)
  return types.length || !useDefaults ? types : [...DEFAULT_PRODUCT_TYPES]
}

export function productTypeIdFor(product) {
  const storedId = cleanId(product?.productTypeId)
  if (storedId) return storedId

  const haystack = `${product?.title || ''} ${product?.description || ''}`.toLocaleLowerCase('es-AR')
  if (/remer[oó]n(?:es)?\b/.test(haystack)) return 'remerones'
  if (/campera(?:s)?\b/.test(haystack)) return 'camperas'
  if (/pantal[oó]n(?:es)?\b/.test(haystack)) return 'pantalones'
  return 'remeras'
}

export function productTypeNameFor(product, productTypes = DEFAULT_PRODUCT_TYPES) {
  const typeId = productTypeIdFor(product)
  return productTypes.find((item) => item.id === typeId)?.name || product?.productTypeName || 'Prenda'
}
