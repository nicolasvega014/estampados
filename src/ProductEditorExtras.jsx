import { useEffect, useRef, useState } from 'react'
import { MAX_PRODUCT_IMAGES, productOptions } from './productOptions'
import { inventoryRows, variantKey } from './productInventory'
import './ProductEditorExtras.css'

export function ProductInventoryEditor({ value, onChange }) {
  const rows = inventoryRows(value)
  const update = (row, next) => {
    const variants = (value.variants || []).filter((entry) => variantKey(entry.size, entry.color) !== variantKey(row.size, row.color))
    onChange({ ...value, variants: [...variants, { ...row, stock: next }] })
  }
  return <section className="product-inventory-editor">
    <label className="inventory-toggle"><input type="checkbox" checked={Boolean(value.trackStock)} onChange={(event) => onChange({ ...value, trackStock: event.target.checked })} /><span>Controlar stock por talle y color</span></label>
    <p>{value.trackStock ? 'Indicá cuántas unidades tenés de cada combinación. Dejá 0 en las que no tengas: no se podrán comprar.' : 'Sin control de cantidades. Los talles y colores marcados se ofrecen en todas sus combinaciones.'}</p>
    {value.trackStock && <>
      <div className="inventory-table-wrap"><table className="inventory-table"><caption>Stock de esta prenda</caption><thead><tr><th scope="col">Talle</th><th scope="col">Color</th><th scope="col">Unidades</th><th scope="col">Reservadas</th></tr></thead><tbody>{rows.map((row) => <tr key={variantKey(row.size, row.color)}><th scope="row">{row.size || 'Único'}</th><td>{row.color || 'Sin variante'}</td><td><input aria-label={`Stock talle ${row.size || 'único'}, color ${row.color || 'único'}`} type="number" inputMode="numeric" min="0" max="99999" step="1" required value={(value.variants || []).find((entry) => variantKey(entry.size, entry.color) === variantKey(row.size, row.color))?.stock ?? 0} onChange={(event) => update(row, event.target.value)} /></td><td>{row.reserved || '—'}</td></tr>)}</tbody></table></div>
      <p className="inventory-help">Las unidades reservadas corresponden a pagos en confirmación. Al aprobarse, se descuentan del stock; si se rechazan, vuelven a estar disponibles.</p>
    </>}
  </section>
}

function PhotoPreview({ photo }) {
  const image = useRef(null)
  useEffect(() => {
    if (!photo.file) return
    const next = URL.createObjectURL(photo.file)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [photo.file, photo.imageUrl])
  return <img ref={image} src={photo.imageUrl || undefined} alt="Vista previa de la prenda" />
}

export function ProductPhotoEditor({ value, onChange }) {
  const [error, setError] = useState('')
  const photos = value.photos || []
  const { colors } = productOptions(value)
  const change = (next) => onChange({ ...value, photos: next })
  const add = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length + photos.length > MAX_PRODUCT_IMAGES) { setError(`Podés cargar hasta ${MAX_PRODUCT_IMAGES} fotos por prenda.`); return }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) { setError('Cada foto debe ser PNG, JPG o WEBP y pesar hasta 10 MB.'); return }
    setError('')
    change([...photos, ...files.map((file) => ({ file, color: '', key: crypto.randomUUID() }))])
  }
  const move = (index, target) => {
    const next = [...photos]
    const [photo] = next.splice(index, 1)
    next.splice(target, 0, photo)
    change(next)
  }
  return <section className="product-photo-editor">
    <h2>Fotos de la prenda</h2><p>Hasta {MAX_PRODUCT_IMAGES} fotos. La primera es la portada; las demás se muestran en la galería.</p>
    <label className="product-photo-upload">Agregar fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={add} disabled={photos.length >= MAX_PRODUCT_IMAGES} /><small>PNG, JPG o WEBP · Máximo 10 MB por foto</small></label>
    {error && <p className="photo-editor-error" role="alert">{error}</p>}
    <div className="product-photo-list">{photos.map((photo, index) => <div className="product-photo-entry" key={photo.key || photo.imageUrl}>
      <PhotoPreview photo={photo} /><strong>{index === 0 ? 'Portada' : `Foto ${index + 1}`}</strong>
      {colors.length > 0 && <label>Color de la foto<select value={photo.color || ''} onChange={(event) => change(photos.map((entry, at) => at === index ? { ...entry, color: event.target.value } : entry))}><option value="">Todos / detalle</option>{colors.map((color) => <option key={color.name}>{color.name}</option>)}</select></label>}
      <div className="photo-actions"><button type="button" disabled={!index} onClick={() => move(index, 0)}>Usar de portada</button><button type="button" disabled={!index} aria-label={`Mover foto ${index + 1} antes`} onClick={() => move(index, index - 1)}>Anterior</button><button type="button" disabled={index === photos.length - 1} aria-label={`Mover foto ${index + 1} después`} onClick={() => move(index, index + 1)}>Siguiente</button><button type="button" aria-label={`Quitar foto ${index + 1}`} onClick={() => change(photos.filter((_, at) => at !== index))}>Quitar</button></div>
    </div>)}</div>
  </section>
}
