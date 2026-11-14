import { productOptions } from './productOptions.js'

export const variantKey = (size = '', color = '') => JSON.stringify([String(size).trim().toLocaleLowerCase('es-AR'), String(color).trim().toLocaleLowerCase('es-AR')])
export const stockNumber = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 99999 ? Number(value) : 0

export function inventoryRows(product) {
  const { sizes, colors } = productOptions(product)
  const saved = new Map((Array.isArray(product?.variants) ? product.variants : []).map((row) => [variantKey(row.size, row.color), row]))
  return (sizes.length ? sizes : ['']).flatMap((size) => (colors.length ? colors.map((color) => color.name) : ['']).map((color) => {
    const row = saved.get(variantKey(size, color))
    return { size, color, stock: stockNumber(row?.stock), reserved: stockNumber(row?.reserved) }
  }))
}

export function availableStock(product, size = '', color = '') {
  if (!product || product.hidden) return 0
  if (!product.trackStock) return Infinity
  const row = inventoryRows(product).find((entry) => variantKey(entry.size, entry.color) === variantKey(size, color))
  return row ? Math.max(0, row.stock - row.reserved) : 0
}

export function hasProductStock(product) {
  return Boolean(product && !product.hidden && (!product.trackStock || inventoryRows(product).some((row) => row.stock > row.reserved)))
}

// Run inside the product-save transaction. A stale seller form must never
// overwrite a sale or the quantities held by a payment still being confirmed.
export function mergeInventoryEdit(draft, original, current) {
  const previous = new Map(inventoryRows(original).map((row) => [variantKey(row.size, row.color), row]))
  const liveRows = Array.isArray(current?.variants) ? current.variants : []
  const live = new Map(liveRows.map((row) => [variantKey(row.size, row.color), row]))
  if (Boolean(original?.trackStock) !== Boolean(current?.trackStock)) throw new Error('El control de stock cambió. Volvé a abrir el producto antes de guardarlo.')
  const rows = draft.trackStock ? inventoryRows(draft) : []
  if (rows.length > 200) throw new Error('Usá hasta 200 combinaciones de talle y color por producto.')
  const keys = new Set(rows.map((row) => variantKey(row.size, row.color)))
  for (const row of liveRows) {
    if (!keys.has(variantKey(row.size, row.color)) && stockNumber(row.reserved) > 0) throw new Error('Hay unidades reservadas por un pago pendiente. No se puede quitar esa combinación ni desactivar su stock todavía.')
  }
  return rows.map((row) => {
    const id = variantKey(row.size, row.color)
    const before = previous.get(id), now = live.get(id)
    const changed = row.stock !== (before?.stock || 0)
    if (changed && now && stockNumber(now.stock) !== (before?.stock || 0)) throw new Error('El stock cambió mientras editabas. Volvé a abrir el producto para ver las cantidades actuales.')
    const stock = !changed && now ? stockNumber(now.stock) : row.stock
    const reserved = stockNumber(now?.reserved)
    if (stock < reserved) throw new Error(`Hay ${reserved} unidades reservadas de ${row.color || 'esta prenda'}${row.size ? `, talle ${row.size}` : ''}. El stock no puede ser menor.`)
    return { ...row, stock, reserved }
  })
}
