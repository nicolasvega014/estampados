import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { DEFAULT_CUSTOMIZER_COLORS, DEFAULT_CUSTOMIZER_SIZES, normalizeCustomizerSettings } from './customizerSettings'
import './Admin.css'
import './AdminProducts.css'
import './AdminStoreSettings.css'
import './CustomizerSettings.css'
import './AdminOffers.css'
import './AdminCoupons.css'

const DEFAULT_CATEGORIES = ['Anime', 'Flores', 'Mascotas', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
const EMPTY_PRODUCT = { title: '', description: '', price: '18900', category: '', imageUrl: '', imagePublicId: '', imageFile: null, id: '' }
const EMPTY_OFFER = { id: '', title: '', description: '', code: '', label: '', active: true }
const EMPTY_COUPON = { id: '', campaignId: '', code: '', title: '', type: 'percentage', value: '', active: true, startsAt: '', expiresAt: '', maxUses: '', usageCount: 0, minPurchase: '', appliesTo: 'all', productIds: [], perCustomerLimit: '' }
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function formatDate(value) {
  if (!value?.toDate) return 'Recién recibido'
  return value.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function getCouponDate(value) {
  if (!value) return null
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value)
  return Number.isNaN(date?.getTime?.()) ? null : date
}

function couponDateInput(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = getCouponDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function couponDateFromInput(value, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCouponDate(value) {
  const date = getCouponDate(value)
  return date ? date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

function couponStatus(coupon) {
  const now = new Date()
  const startsAt = getCouponDate(coupon.startsAt)
  const expiresAt = getCouponDate(coupon.expiresAt)
  const maxUses = Number(coupon.maxUses)
  const usesCount = Number(coupon.usageCount || 0)
  if (coupon.active === false) return { label: 'Pausado', tone: 'paused' }
  if (startsAt && startsAt > now) return { label: 'Programado', tone: 'scheduled' }
  if (expiresAt && expiresAt < now) return { label: 'Vencido', tone: 'expired' }
  if (Number.isFinite(maxUses) && maxUses > 0 && usesCount >= maxUses) return { label: 'Agotado', tone: 'exhausted' }
  return { label: 'Activo', tone: 'active' }
}

function formatCouponDiscount(coupon) {
  const amount = Number(coupon.value || 0)
  return coupon.type === 'fixed' ? `$ ${amount.toLocaleString('es-AR')} de descuento` : `${amount}% de descuento`
}

function newCouponCampaignId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

async function uploadImage(file, kind) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Usá una imagen PNG, JPG o WEBP.')
  if (file.size > MAX_IMAGE_SIZE) throw new Error('La imagen no puede superar los 10 MB.')

  const idToken = await auth.currentUser?.getIdToken()
  const signatureResponse = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken || ''}` },
    body: JSON.stringify({ kind }),
  })
  const signature = await signatureResponse.json().catch(() => ({}))
  if (!signatureResponse.ok) throw new Error(signature.message || 'No se pudo preparar la carga.')

  const body = new FormData()
  body.append('file', file)
  body.append('api_key', signature.apiKey)
  body.append('timestamp', String(signature.timestamp))
  body.append('folder', signature.folder)
  body.append('signature', signature.signature)

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body })
  const uploaded = await uploadResponse.json().catch(() => ({}))
  if (!uploadResponse.ok) throw new Error(uploaded?.error?.message || 'Cloudinary no pudo subir la imagen.')

  return { imageUrl: uploaded.secure_url, imagePublicId: uploaded.public_id }
}

export default function Admin() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState('pedidos')
  const [orders, setOrders] = useState([])
  const [designs, setDesigns] = useState([])
  const [products, setProducts] = useState([])
  const [seedProducts, setSeedProducts] = useState([])
  const [storedProducts, setStoredProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [upload, setUpload] = useState({ title: '', category: '', file: null })
  const [product, setProduct] = useState(EMPTY_PRODUCT)
  const [categoryName, setCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')

  useEffect(() => onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setLoading(false) }), [])

  useEffect(() => { fetch('/products/catalog.json').then((response) => response.ok ? response.json() : []).then((items) => setSeedProducts(Array.isArray(items) ? items : [])).catch(() => {}) }, [])

  useEffect(() => {
    const catalog = new Map(seedProducts.map((item) => [item.id, { ...item, isSeed: true }]))
    storedProducts.forEach((item) => {
      const isSeed = catalog.has(item.id)
      if (item.hidden) catalog.delete(item.id)
      else catalog.set(item.id, { ...catalog.get(item.id), ...item, isSeed })
    })
    setProducts([...catalog.values()])
  }, [seedProducts, storedProducts])

  useEffect(() => {
    if (!user) return undefined
    const stopOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar los pedidos.'))
    const stopDesigns = onSnapshot(query(collection(db, 'designs'), orderBy('createdAt', 'desc')), (snapshot) => setDesigns(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar los diseños.'))
    const stopProducts = onSnapshot(collection(db, 'products'), (snapshot) => setStoredProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar los productos.'))
    const stopCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar las categorías.'))
    return () => { stopOrders(); stopDesigns(); stopProducts(); stopCategories() }
  }, [user])

  const categoryOptions = categories.length ? categories.map((item) => item.name) : DEFAULT_CATEGORIES

  async function login(event) {
    event.preventDefault()
    setMessage('')
    try { await signInWithEmailAndPassword(auth, email.trim(), password) }
    catch { setMessage('No se pudo ingresar. Revisá el correo y la contraseña.') }
  }

  async function addCategory(event) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) return
    try {
      if (editingCategoryId) await updateDoc(doc(db, 'categories', editingCategoryId), { name })
      else await addDoc(collection(db, 'categories'), { name, createdAt: serverTimestamp() })
      setCategoryName('')
      setEditingCategoryId('')
      setMessage(editingCategoryId ? 'Categoría actualizada.' : 'Categoría agregada.')
    } catch { setMessage('No se pudo agregar la categoría.') }
  }

  async function addDesign(event) {
    event.preventDefault()
    if ((!upload.file && !upload.id) || !upload.category) { setMessage('Elegí una imagen y una categoría.'); return }
    if (upload.id) {
      try {
        const data = { title: upload.title.trim() || 'Diseño sin nombre', category: upload.category }
        if (upload.file) {
          setMessage('Subiendo imagen…')
          Object.assign(data, await uploadImage(upload.file, 'designs'))
        }
        await updateDoc(doc(db, 'designs', upload.id), data)
        setUpload({ title: '', category: '', file: null, id: '' })
        event.target.reset()
        setMessage('Diseño actualizado.')
      } catch { setMessage('No se pudo actualizar el diseño.') }
      return
    }
    setMessage('Subiendo diseño…')
    try {
      const image = await uploadImage(upload.file, 'designs')
      await addDoc(collection(db, 'designs'), { title: upload.title.trim() || upload.file.name, category: upload.category, ...image, createdAt: serverTimestamp() })
      setUpload({ title: '', category: '', file: null, id: '' })
      event.target.reset()
      setMessage('Diseño publicado en el catálogo.')
    } catch (error) { setMessage(error.message || 'No se pudo subir el diseño.') }
  }

  async function addProduct(event) {
    event.preventDefault()
    const title = product.title.trim()
    const price = Number(product.price)
    if (!title || !Number.isFinite(price) || price < 0) { setMessage('Completá el nombre y un precio válido.'); return }
    try {
      setMessage(product.imageFile ? 'Subiendo imagen…' : 'Guardando producto…')
      const data = { title, description: product.description.trim(), price, category: product.category || 'Remeras', imageUrl: product.imageUrl.trim(), imagePublicId: product.imagePublicId || '' }
      if (product.imageFile) Object.assign(data, await uploadImage(product.imageFile, 'products'))
      if (product.id) await setDoc(doc(db, 'products', product.id), { ...data, hidden: false }, { merge: true })
      else await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() })
      setProduct(EMPTY_PRODUCT)
      setMessage(product.id ? 'Producto actualizado.' : 'Producto guardado en el catálogo.')
    } catch (error) { setMessage(error.message || 'No se pudo guardar el producto.') }
  }

  async function remove(collectionName, id) {
    if (!window.confirm('¿Querés quitar este elemento?')) return
    try {
      const item = collectionName === 'products' ? products.find((product) => product.id === id) : null
      if (item?.isSeed) await setDoc(doc(db, 'products', id), { hidden: true }, { merge: true })
      else await deleteDoc(doc(db, collectionName, id))
      setMessage('Elemento eliminado.')
    }
    catch { setMessage('No se pudo eliminar el elemento.') }
  }

  function editProduct(item) { setProduct({ id: item.id, title: item.title || '', description: item.description || '', price: String(item.price ?? ''), category: item.category || '', imageUrl: item.imageUrl || '', imagePublicId: item.imagePublicId || '', imageFile: null }); setMessage('Editando producto. Guardá los cambios cuando termines.') }
  function editDesign(item) { setUpload({ id: item.id, title: item.title || '', category: item.category || '', file: null }); setMessage('Editando diseño. La imagen actual se conserva.') }
  function editCategory(item) { setCategoryName(item.name || ''); setEditingCategoryId(item.id); setMessage('Editando categoría.') }
  useEffect(() => {
    const handleEdit = (event) => {
      const { type, id } = event.detail || {}
      if (type === 'products') editProduct(products.find((item) => item.id === id))
      if (type === 'designs') editDesign(designs.find((item) => item.id === id))
      if (type === 'categories') editCategory(categories.find((item) => item.id === id))
    }
    window.addEventListener('tinta-admin-edit', handleEdit)
    return () => window.removeEventListener('tinta-admin-edit', handleEdit)
  }, [products, designs, categories])

  if (loading) return <main className="admin-loading">Cargando panel…</main>

  if (!user) return <main className="admin-login"><a className="admin-brand" href="/">TINTA<span>•</span>CLUB</a><section><p className="admin-kicker">PANEL DEL VENDEDOR</p><h1>Administrá tu tienda.</h1><p>Ingresá con tu cuenta de vendedor para manejar el catálogo y los pedidos.</p><form onSubmit={login}><label>Correo<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label><label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>{message && <p className="admin-message">{message}</p>}<button>Ingresar al panel <span>→</span></button></form></section></main>

  return <main className="admin-page"><header className="admin-header"><a className="admin-brand" href="/">TINTA<span>•</span>CLUB</a><div><span>{user.email}</span><button className="admin-logout" onClick={() => signOut(auth)}>Salir</button></div></header><div className="admin-layout"><aside><p className="admin-kicker">ADMINISTRACIÓN</p><button className={active === 'pedidos' ? 'active' : ''} onClick={() => setActive('pedidos')}>Pedidos <b>{orders.length}</b></button><button className={active === 'productos' ? 'active' : ''} onClick={() => setActive('productos')}>Productos <b>{products.length}</b></button><button className={active === 'disenos' ? 'active' : ''} onClick={() => setActive('disenos')}>Diseños <b>{designs.length}</b></button><button className={active === 'ofertas' ? 'active' : ''} onClick={() => setActive('ofertas')}>Ofertas</button><button className={active === 'cupones' ? 'active' : ''} onClick={() => setActive('cupones')}>Cupones</button><button className={active === 'personalizador' ? 'active' : ''} onClick={() => setActive('personalizador')}>Personalizador</button><button className={active === 'categorias' ? 'active' : ''} onClick={() => setActive('categorias')}>Categorías <b>{categories.length}</b></button><a href="/">Ver tienda <span>↗</span></a></aside><section className="admin-content">{message && <p className="admin-toast">{message}</p>}{active === 'pedidos' && <Orders orders={orders} />}{active === 'productos' && <Products items={products} value={product} setValue={setProduct} categories={categoryOptions} onAdd={addProduct} onRemove={remove} />}{active === 'disenos' && <Designs designs={designs} upload={upload} setUpload={setUpload} categories={categoryOptions} onAdd={addDesign} onRemove={remove} />}{active === 'ofertas' && <Offers />}{active === 'cupones' && <Coupons products={products} />}{active === 'personalizador' && <CustomizerSettings />}{active === 'categorias' && <Categories items={categories} value={categoryName} setValue={setCategoryName} onAdd={addCategory} onRemove={remove} />}</section></div></main>
}

function Orders({ orders }) { return <><div className="admin-title"><div><p className="admin-kicker">VENTAS</p><h1>Pedidos</h1></div><p>Acá vas a ver los pedidos confirmados por tus clientes.</p></div>{orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}><div><b>#{order.id.slice(0, 6).toUpperCase()}</b><span>{formatDate(order.createdAt)}</span></div><h2>{order.customerName || 'Pedido de remera personalizada'}</h2><p>{order.size || 'Talle sin indicar'} · {order.color || 'Color sin indicar'} · {order.status || 'Nuevo'}</p></article>)}</div> : <Empty title="Todavía no hay pedidos" text="Cuando conectemos el botón de compra, los pedidos van a aparecer acá." />}</> }
function editItem(type, id) { window.dispatchEvent(new CustomEvent('tinta-admin-edit', { detail: { type, id } })) }
function Designs({ designs, upload, setUpload, categories, onAdd, onRemove }) {
  return <>
    <div className="admin-title"><div><p className="admin-kicker">CATÁLOGO</p><h1>Diseños</h1></div><p>Subí una imagen y elegí la categoría donde querés mostrarla.</p></div>
    <form className="upload-form" onSubmit={onAdd}>
      <label>Imagen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} required={!upload.id} /><small>{upload.file?.name || (upload.id ? 'La imagen actual se conserva.' : 'PNG, JPG o WEBP · Máx. 10 MB')}</small></label>
      <label>Nombre<input value={upload.title} onChange={(event) => setUpload({ ...upload, title: event.target.value })} placeholder="Ej. Gato con anteojos" /></label>
      <label>Categoría<select value={upload.category} onChange={(event) => setUpload({ ...upload, category: event.target.value })} required><option value="">Elegí una</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <button>{upload.id ? 'Guardar cambios' : 'Subir diseño'} <span>{upload.id ? '✓' : '↑'}</span></button>
    </form>
    {designs.length ? <div className="design-grid">{designs.map((design) => <article key={design.id}><img src={design.imageUrl} alt={design.title} /><div><span>{design.category}</span><h2>{design.title}</h2><div className="admin-actions"><button onClick={() => editItem('designs', design.id)}>Editar</button><button onClick={() => onRemove('designs', design.id)}>Quitar</button></div></div></article>)}</div> : <Empty title="Aún no subiste diseños" text="Los diseños que publiques desde acá se van a organizar por categoría." />}
  </>
}

function Products({ items, value, setValue, categories, onAdd, onRemove }) {
  const update = (field, next) => setValue({ ...value, [field]: next })
  return <>
    <div className="admin-title"><div><p className="admin-kicker">TIENDA</p><h1>Productos</h1></div><p>Creá tus remeras, packs o servicios. Elegí una foto desde tu equipo: queda guardada con el producto.</p></div>
    <form className="product-form" onSubmit={onAdd}>
      <label>Nombre del producto<input value={value.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Remera clásica" required /></label>
      <label>Precio<input value={value.price} onChange={(event) => update('price', event.target.value)} type="number" min="0" step="1" required /></label>
      <label>Categoría<select value={value.category} onChange={(event) => update('category', event.target.value)}><option value="">Remeras</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="product-description">Descripción<textarea value={value.description} onChange={(event) => update('description', event.target.value)} placeholder="Ej. Algodón premium, estampado personalizado incluido." rows="3" /></label>
      <label className="product-image">Foto del producto <small>{value.imageFile?.name || (value.imageUrl ? 'Elegí otra foto para reemplazar la actual.' : 'Opcional · PNG, JPG o WEBP · Máx. 10 MB')}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => update('imageFile', event.target.files?.[0] || null)} /></label>
      <button>{value.id ? 'Guardar cambios' : 'Guardar producto'} <span>{value.id ? '✓' : '+'}</span></button>
    </form>
    {items.length ? <div className="product-grid">{items.map((product) => <article key={product.id}><div className="product-image-preview">{product.imageUrl ? <img src={product.imageUrl} alt={product.title} /> : <span>REMERA<br/>FENIXIS</span>}</div><div><span>{product.category}</span><h2>{product.title}</h2>{product.description && <p>{product.description}</p>}<strong>$ {Number(product.price || 0).toLocaleString('es-AR')}</strong><div className="admin-actions"><button onClick={() => editItem('products', product.id)}>Editar</button><button onClick={() => onRemove('products', product.id)}>Quitar</button></div></div></article>)}</div> : <Empty title="Todavía no hay productos" text="Podés empezar con la remera personalizada y agregar una foto cuando la tengas." />}
  </>
}
function Coupons({ products }) {
  const [coupons, setCoupons] = useState([])
  const [coupon, setCoupon] = useState(EMPTY_COUPON)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const stop = onSnapshot(query(collection(db, 'coupons'), orderBy('createdAt', 'desc')), (snapshot) => {
      setCoupons(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    }, () => setNotice('No se pudieron cargar los cupones.'))
    return () => stop()
  }, [])

  const update = (field, value) => setCoupon((current) => ({ ...current, [field]: value }))
  const selectedProductIds = Array.isArray(coupon.productIds) ? coupon.productIds : []

  function toggleProduct(productId) {
    setCoupon((current) => {
      const selected = Array.isArray(current.productIds) ? current.productIds : []
      return {
        ...current,
        productIds: selected.includes(productId) ? selected.filter((id) => id !== productId) : [...selected, productId],
      }
    })
  }

  async function saveCoupon(event) {
    event.preventDefault()
    const code = coupon.code.trim().toUpperCase().replace(/\s+/g, '')
    const title = coupon.title.trim()
    const value = Number(coupon.value)
    const maxUses = coupon.maxUses === '' ? null : Number(coupon.maxUses)
    const minPurchase = coupon.minPurchase === '' ? null : Number(coupon.minPurchase)
    const perCustomerLimit = coupon.perCustomerLimit === '' ? null : Number(coupon.perCustomerLimit)
    const startsAt = couponDateFromInput(coupon.startsAt)
    const expiresAt = couponDateFromInput(coupon.expiresAt, true)
    const productIds = [...new Set(selectedProductIds.filter(Boolean))]

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { setNotice('Usá un código de 3 a 30 caracteres: letras, números, guion o guion bajo.'); return }
    if (!title) { setNotice('Agregá un nombre para reconocer el cupón en el panel.'); return }
    if (!Number.isFinite(value) || value <= 0 || (coupon.type === 'percentage' && value >= 100)) { setNotice(coupon.type === 'percentage' ? 'El descuento debe ser mayor a 0 y menor al 100% para que Mercado Pago pueda cobrar el pedido.' : 'Ingresá un monto de descuento válido.'); return }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) { setNotice('El límite total de usos debe ser un número entero mayor a 0.'); return }
    if (perCustomerLimit !== null && (!Number.isInteger(perCustomerLimit) || perCustomerLimit < 1)) { setNotice('El límite por persona debe ser un número entero mayor a 0.'); return }
    if (minPurchase !== null && (!Number.isFinite(minPurchase) || minPurchase < 0)) { setNotice('El mínimo de compra debe ser un importe válido.'); return }
    if (coupon.startsAt && !startsAt) { setNotice('Revisá la fecha de inicio.'); return }
    if (coupon.expiresAt && !expiresAt) { setNotice('Revisá la fecha de vencimiento.'); return }
    if (startsAt && expiresAt && expiresAt < startsAt) { setNotice('El vencimiento tiene que ser posterior a la fecha de inicio.'); return }
    if (coupon.appliesTo === 'products' && !productIds.length) { setNotice('Elegí al menos un producto o marcá que aplique a toda la tienda.'); return }

    const duplicate = coupons.find((item) => (item.codeNormalized || item.code || '').toUpperCase() === code && item.id !== coupon.id)
    if (duplicate) { setNotice('Ya existe un cupón con ese código. Elegí otro.'); return }

    const data = {
      campaignId: coupon.campaignId || newCouponCampaignId(),
      code,
      codeNormalized: code,
      title,
      type: coupon.type === 'fixed' ? 'fixed' : 'percentage',
      value,
      active: Boolean(coupon.active),
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      maxUses,
      minPurchase,
      perCustomerLimit,
      appliesTo: coupon.appliesTo === 'products' ? productIds : 'all',
      updatedAt: serverTimestamp(),
    }

    try {
      if (coupon.id) {
        await updateDoc(doc(db, 'coupons', coupon.id), data)
      } else {
        const couponRef = doc(db, 'coupons', code)
        await runTransaction(db, async (transaction) => {
          const current = await transaction.get(couponRef)
          if (current.exists()) throw new Error('duplicate-coupon')
          transaction.set(couponRef, { ...data, usageCount: 0, createdAt: serverTimestamp() })
        })
      }
      setNotice(coupon.id ? 'Cupón actualizado.' : 'Cupón creado y listo para usar en el carrito.')
      setCoupon(EMPTY_COUPON)
    } catch (error) {
      setNotice(error?.message === 'duplicate-coupon' ? 'Ya existe un cupón con ese código. Elegí otro.' : 'No se pudo guardar el cupón.')
    }
  }

  function editCoupon(item) {
    const scopedProducts = Array.isArray(item.appliesTo) ? item.appliesTo : []
    setCoupon({
      id: item.id,
      campaignId: item.campaignId || newCouponCampaignId(),
      code: item.code || item.id || '',
      title: item.title || '',
      type: item.type === 'fixed' ? 'fixed' : 'percentage',
      value: item.value === undefined || item.value === null ? '' : String(item.value),
      active: item.active !== false,
      startsAt: couponDateInput(item.startsAt),
      expiresAt: couponDateInput(item.expiresAt),
      maxUses: item.maxUses === undefined || item.maxUses === null ? '' : String(item.maxUses),
      usageCount: Number(item.usageCount || 0),
      minPurchase: item.minPurchase === undefined || item.minPurchase === null ? '' : String(item.minPurchase),
      appliesTo: scopedProducts.length ? 'products' : 'all',
      productIds: scopedProducts,
      perCustomerLimit: item.perCustomerLimit === undefined || item.perCustomerLimit === null ? '' : String(item.perCustomerLimit),
    })
    setNotice('Editando cupón. El código se mantiene para conservar su historial de usos.')
  }

  async function toggleCoupon(item) {
    try {
      await updateDoc(doc(db, 'coupons', item.id), { active: item.active === false, updatedAt: serverTimestamp() })
      setNotice(item.active === false ? 'Cupón activado.' : 'Cupón pausado. Ya no se podrá usar al pagar.')
    } catch { setNotice('No se pudo cambiar el estado del cupón.') }
  }

  async function removeCoupon(item) {
    if (!window.confirm('¿Querés eliminar el cupón “' + item.code + '”?')) return
    try {
      await deleteDoc(doc(db, 'coupons', item.id))
      if (coupon.id === item.id) setCoupon(EMPTY_COUPON)
      setNotice('Cupón eliminado.')
    } catch { setNotice('No se pudo eliminar el cupón.') }
  }

  function cancelEdit() {
    setCoupon(EMPTY_COUPON)
    setNotice('Edición cancelada.')
  }

  return <section className="admin-coupons">
    <div className="admin-title"><div><p className="admin-kicker">DESCUENTOS</p><h1>Cupones</h1></div><p>Creá códigos con vencimiento, límites de uso y condiciones para el carrito.</p></div>
    <form className="coupon-form" onSubmit={saveCoupon}>
      <div className="coupon-form-heading"><div><h2>{coupon.id ? 'Editar cupón' : 'Nuevo cupón'}</h2><p>El descuento se valida antes de enviar al cliente a Mercado Pago.</p></div>{coupon.id && <button type="button" className="coupon-button-secondary" onClick={cancelEdit}>Cancelar edición</button>}</div>
      <div className="coupon-form-fields">
        <label>Código<input value={coupon.code} onChange={(event) => update('code', event.target.value.toUpperCase())} maxLength="30" pattern="[A-Za-z0-9_-]{3,30}" placeholder="Ej. FENIXIS20" disabled={Boolean(coupon.id)} required /><small>{coupon.id ? 'El código no se modifica para conservar el historial.' : 'Se guarda en mayúsculas y no se puede repetir.'}</small></label>
        <label>Nombre interno<input value={coupon.title} onChange={(event) => update('title', event.target.value)} maxLength="60" placeholder="Ej. Lanzamiento octubre" required /><small>Solo se ve en este panel.</small></label>
        <label>Tipo de descuento<select value={coupon.type} onChange={(event) => update('type', event.target.value)}><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label>
        <label>{coupon.type === 'fixed' ? 'Monto a descontar' : 'Porcentaje a descontar'}<input value={coupon.value} onChange={(event) => update('value', event.target.value)} type="number" min="1" max={coupon.type === 'percentage' ? '99' : undefined} step="1" inputMode="numeric" placeholder={coupon.type === 'fixed' ? 'Ej. 3000' : 'Ej. 20'} required /></label>
        <label>Compra mínima <small>Opcional</small><input value={coupon.minPurchase} onChange={(event) => update('minPurchase', event.target.value)} type="number" min="0" step="1" inputMode="numeric" placeholder="Ej. 20000" /></label>
        <label>Límite total de usos <small>Opcional</small><input value={coupon.maxUses} onChange={(event) => update('maxUses', event.target.value)} type="number" min="1" step="1" inputMode="numeric" placeholder="Sin límite" /></label>
        <label>Límite por email de pago <small>Opcional</small><input value={coupon.perCustomerLimit} onChange={(event) => update('perCustomerLimit', event.target.value)} type="number" min="1" step="1" inputMode="numeric" placeholder="Sin límite" /></label>
        <label>Inicio <small>Opcional</small><input value={coupon.startsAt} onChange={(event) => update('startsAt', event.target.value)} type="date" /></label>
        <label>Vencimiento <small>Opcional</small><input value={coupon.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} type="date" /></label>
        <label>Aplica a<select value={coupon.appliesTo} onChange={(event) => update('appliesTo', event.target.value)}><option value="all">Toda la tienda</option><option value="products">Productos elegidos</option></select></label>
      </div>
      {coupon.appliesTo === 'products' && <fieldset className="coupon-products"><legend>Elegí los productos</legend><p>El descuento solo se aplicará sobre los productos que marques.</p>{products.length ? <div>{products.map((product) => <label className="coupon-product-option" key={product.id}><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span><b>{product.title}</b><small>{product.category || 'Remeras'} · $ {Number(product.price || 0).toLocaleString('es-AR')}</small></span></label>)}</div> : <small>Todavía no hay productos disponibles para seleccionar.</small>}</fieldset>}
      <div className="coupon-form-footer"><label className="coupon-active"><input type="checkbox" checked={coupon.active} onChange={(event) => update('active', event.target.checked)} /><span><b>Cupón activo</b><small>Puede usarse si también cumple sus fechas y límites.</small></span></label><button className="coupon-save">{coupon.id ? 'Guardar cambios' : 'Crear cupón'} <span>{coupon.id ? '✓' : '+'}</span></button></div>
    </form>
    {notice && <p className="coupon-notice">{notice}</p>}
    {coupons.length ? <div className="coupon-list">{coupons.map((item) => {
      const status = couponStatus(item)
      const maxUses = Number(item.maxUses)
      const usageCount = Number(item.usageCount || 0)
      const productCount = Array.isArray(item.appliesTo) ? item.appliesTo.length : 0
      return <article className={'coupon-card coupon-card--' + status.tone} key={item.id}>
        <div className="coupon-card-top"><code>{item.code}</code><b className={'coupon-status coupon-status--' + status.tone}>{status.label}</b></div>
        <h2>{item.title || item.code}</h2>
        <strong className="coupon-discount">{formatCouponDiscount(item)}</strong>
        <dl className="coupon-card-details">
          <div><dt>Usos</dt><dd>{Number.isFinite(maxUses) && maxUses > 0 ? usageCount + ' / ' + maxUses : usageCount + ' sin límite'}</dd></div>
          <div><dt>Compra mínima</dt><dd>{Number(item.minPurchase) > 0 ? '$ ' + Number(item.minPurchase).toLocaleString('es-AR') : 'Sin mínimo'}</dd></div>
          <div><dt>Vigencia</dt><dd>{item.startsAt ? 'Desde ' + formatCouponDate(item.startsAt) : 'Desde ahora'}{item.expiresAt ? ' · Hasta ' + formatCouponDate(item.expiresAt) : ''}</dd></div>
          <div><dt>Productos</dt><dd>{Array.isArray(item.appliesTo) ? productCount + ' elegidos' : 'Toda la tienda'}</dd></div>
          {Number(item.perCustomerLimit) > 0 && <div><dt>Por email</dt><dd>Máx. {Number(item.perCustomerLimit)}</dd></div>}
        </dl>
        <div className="coupon-card-actions"><button type="button" onClick={() => editCoupon(item)}>Editar</button><button type="button" onClick={() => toggleCoupon(item)}>{item.active === false ? 'Activar' : 'Pausar'}</button><button type="button" className="coupon-delete" onClick={() => removeCoupon(item)}>Eliminar</button></div>
      </article>
    })}</div> : <Empty title="Todavía no hay cupones" text="Creá uno para ofrecer un descuento desde el carrito." />}
  </section>
}
function Offers() {
  const [offers, setOffers] = useState([])
  const [offer, setOffer] = useState(EMPTY_OFFER)
  const [notice, setNotice] = useState('')

  useEffect(() => onSnapshot(query(collection(db, 'offers'), orderBy('createdAt', 'desc')), (snapshot) => {
    setOffers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, () => setNotice('No se pudieron cargar las ofertas.')), [])

  const update = (field, value) => setOffer((current) => ({ ...current, [field]: value }))

  async function saveOffer(event) {
    event.preventDefault()
    const title = offer.title.trim()
    const description = offer.description.trim()
    if (!title || !description) { setNotice('Completá el título y la descripción de la oferta.'); return }

    const data = {
      title,
      description,
      code: offer.code.trim().toUpperCase(),
      label: offer.label.trim().toUpperCase(),
      active: Boolean(offer.active),
      updatedAt: serverTimestamp(),
    }

    try {
      if (offer.id) await updateDoc(doc(db, 'offers', offer.id), data)
      else await addDoc(collection(db, 'offers'), { ...data, createdAt: serverTimestamp() })
      setNotice(offer.id ? 'Oferta actualizada.' : 'Oferta creada y lista para mostrar en el inicio.')
      setOffer(EMPTY_OFFER)
    } catch { setNotice('No se pudo guardar la oferta.') }
  }

  function editOffer(item) {
    setOffer({
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      code: item.code || '',
      label: item.label || '',
      active: item.active !== false,
    })
    setNotice('Editando oferta. Guardá los cambios cuando termines.')
  }

  async function toggleOffer(item) {
    try {
      await updateDoc(doc(db, 'offers', item.id), { active: item.active === false, updatedAt: serverTimestamp() })
      setNotice(item.active === false ? 'Oferta activada.' : 'Oferta pausada. Ya no se mostrará en el inicio.')
    } catch { setNotice('No se pudo cambiar el estado de la oferta.') }
  }

  async function removeOffer(item) {
    if (!window.confirm(`¿Querés eliminar la oferta “${item.title}”?`)) return
    try {
      await deleteDoc(doc(db, 'offers', item.id))
      if (offer.id === item.id) setOffer(EMPTY_OFFER)
      setNotice('Oferta eliminada.')
    } catch { setNotice('No se pudo eliminar la oferta.') }
  }

  function cancelEdit() {
    setOffer(EMPTY_OFFER)
    setNotice('Edición cancelada.')
  }

  return <section className="admin-offers">
    <div className="admin-title"><div><p className="admin-kicker">INICIO</p><h1>Ofertas</h1></div><p>Creá avisos, promociones o códigos para destacarlos en la página principal.</p></div>
    <form className="offer-form" onSubmit={saveOffer}>
      <div className="offer-form-heading"><div><h2>{offer.id ? 'Editar oferta' : 'Nueva oferta'}</h2><p>Las ofertas activas serán las que puedan aparecer en el inicio.</p></div>{offer.id && <button type="button" className="offer-button-secondary" onClick={cancelEdit}>Cancelar edición</button>}</div>
      <div className="offer-form-fields">
        <label>Título<input value={offer.title} onChange={(event) => update('title', event.target.value)} maxLength="70" placeholder="Ej. 2 remeras por $22.000" required /></label>
        <label>Etiqueta <small>Opcional</small><input value={offer.label} onChange={(event) => update('label', event.target.value)} maxLength="28" placeholder="Ej. OFERTA ESPECIAL" /></label>
        <label className="offer-form-description">Descripción<textarea value={offer.description} onChange={(event) => update('description', event.target.value)} maxLength="180" rows="3" placeholder="Contá brevemente qué incluye o cómo aprovechar la oferta." required /></label>
        <label>Código promocional <small>Opcional</small><input value={offer.code} onChange={(event) => update('code', event.target.value)} maxLength="30" placeholder="Ej. FENIX10" /></label>
      </div>
      <div className="offer-form-footer"><label className="offer-active"><input type="checkbox" checked={offer.active} onChange={(event) => update('active', event.target.checked)} /><span><b>Oferta activa</b><small>Mostrala en la página de inicio.</small></span></label><button className="offer-save">{offer.id ? 'Guardar cambios' : 'Crear oferta'} <span>{offer.id ? '✓' : '+'}</span></button></div>
    </form>
    {notice && <p className="offer-notice">{notice}</p>}
    {offers.length ? <div className="offer-list">{offers.map((item) => <article className={`offer-card ${item.active === false ? 'is-paused' : ''}`} key={item.id}>
      <div className="offer-card-top"><span>{item.label || 'OFERTA'}</span><b className={item.active === false ? 'is-paused' : ''}>{item.active === false ? 'Pausada' : 'Activa'}</b></div>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      {item.code && <div className="offer-code"><span>Código</span><strong>{item.code}</strong></div>}
      <div className="offer-card-actions"><button type="button" onClick={() => editOffer(item)}>Editar</button><button type="button" onClick={() => toggleOffer(item)}>{item.active === false ? 'Activar' : 'Pausar'}</button><button type="button" className="offer-delete" onClick={() => removeOffer(item)}>Eliminar</button></div>
    </article>)}</div> : <Empty title="Todavía no hay ofertas" text="Creá la primera promoción para poder destacarla en el inicio." />}
  </section>
}
function CustomizerSettings() {
  const [settings, setSettings] = useState(() => normalizeCustomizerSettings())
  const [notice, setNotice] = useState('')

  useEffect(() => onSnapshot(doc(db, 'settings', 'customizer'), (snapshot) => {
    setSettings(normalizeCustomizerSettings(snapshot.data()))
  }, () => setNotice('No se pudieron cargar los ajustes del personalizador.')), [])

  const updateColor = (index, field, value) => setSettings((current) => ({
    ...current,
    colors: current.colors.map((color, colorIndex) => colorIndex === index ? { ...color, [field]: value } : color),
  }))
  const updateSize = (index, value) => setSettings((current) => ({
    ...current,
    sizes: current.sizes.map((size, sizeIndex) => sizeIndex === index ? value : size),
  }))
  const addColor = () => setSettings((current) => ({ ...current, colors: [...current.colors, { name: 'Nuevo color', value: '#1b1b1b' }] }))
  const addSize = () => setSettings((current) => ({ ...current, sizes: [...current.sizes, ''] }))
  const removeColor = (index) => setSettings((current) => ({ ...current, colors: current.colors.filter((_, colorIndex) => colorIndex !== index) }))
  const removeSize = (index) => setSettings((current) => ({ ...current, sizes: current.sizes.filter((_, sizeIndex) => sizeIndex !== index) }))

  function restoreDefaults() {
    setSettings({ colors: DEFAULT_CUSTOMIZER_COLORS.map((color) => ({ ...color })), sizes: [...DEFAULT_CUSTOMIZER_SIZES] })
    setNotice('Se restauraron las opciones iniciales. Guardá los cambios para aplicarlas en la tienda.')
  }

  async function save(event) {
    event.preventDefault()
    const colors = settings.colors.map((color) => ({ name: String(color.name || '').trim().slice(0, 30), value: String(color.value || '').trim() }))
    const sizes = settings.sizes.map((size) => String(size || '').trim().toUpperCase().slice(0, 8)).filter(Boolean)

    if (!colors.length || !sizes.length) { setNotice('Agregá al menos un color y un talle.'); return }
    if (colors.some((color) => !color.name || !/^#[0-9a-f]{6}$/i.test(color.value))) { setNotice('Revisá los colores: cada uno necesita nombre y un código hexadecimal válido.'); return }
    if (new Set(colors.map((color) => color.name.toLocaleLowerCase('es-AR'))).size !== colors.length) { setNotice('No repitas nombres de colores.'); return }
    if (new Set(sizes).size !== sizes.length) { setNotice('No repitas talles.'); return }

    try {
      await setDoc(doc(db, 'settings', 'customizer'), { colors, sizes, updatedAt: serverTimestamp() }, { merge: true })
      setSettings({ colors, sizes })
      setNotice('Cambios guardados. La página Personalizá se actualizó.')
    } catch { setNotice('No se pudieron guardar los cambios.') }
  }

  return <section className="customizer-settings">
    <div className="admin-title"><div><p className="admin-kicker">PERSONALIZÁ</p><h1>Opciones de la remera</h1></div><p>Elegí los talles y colores que se mostrarán cuando una persona arme su remera.</p></div>
    <form onSubmit={save}>
      <section className="customizer-settings-group">
        <div className="customizer-settings-heading"><div><h2>Colores</h2><p>Podés cambiar el nombre, el tono y el orden en que aparecen.</p></div><button type="button" className="customizer-settings-secondary" onClick={addColor}>+ Agregar color</button></div>
        <div className="customizer-colors-list">
          {settings.colors.map((color, index) => <div className="customizer-color-row" key={index}>
            <input className="customizer-color-picker" type="color" aria-label={`Elegir color ${index + 1}`} value={/^#[0-9a-f]{6}$/i.test(color.value) ? color.value : '#1b1b1b'} onChange={(event) => updateColor(index, 'value', event.target.value)} />
            <label>Nombre<input value={color.name} maxLength="30" onChange={(event) => updateColor(index, 'name', event.target.value)} placeholder="Ej. Blanco" /></label>
            <label>Código<input value={color.value} maxLength="7" onChange={(event) => updateColor(index, 'value', event.target.value)} placeholder="#ffffff" /></label>
            <button type="button" className="customizer-settings-remove" onClick={() => removeColor(index)} aria-label={`Quitar ${color.name || 'color'}`}>Quitar</button>
          </div>)}
        </div>
      </section>
      <section className="customizer-settings-group">
        <div className="customizer-settings-heading"><div><h2>Talles</h2><p>Usá las abreviaturas que querés ofrecer, por ejemplo S, M, L o XL.</p></div><button type="button" className="customizer-settings-secondary" onClick={addSize}>+ Agregar talle</button></div>
        <div className="customizer-sizes-list">
          {settings.sizes.map((size, index) => <div className="customizer-size-row" key={index}><label>Talle<input value={size} maxLength="8" onChange={(event) => updateSize(index, event.target.value.toUpperCase())} placeholder="Ej. M" /></label><button type="button" className="customizer-settings-remove" onClick={() => removeSize(index)} aria-label={`Quitar talle ${size || index + 1}`}>Quitar</button></div>)}
        </div>
      </section>
      <div className="customizer-settings-actions"><button type="button" className="customizer-settings-secondary" onClick={restoreDefaults}>Restablecer iniciales</button><button className="customizer-settings-save">Guardar cambios <span>✓</span></button></div>
      {notice && <p className="customizer-settings-notice">{notice}</p>}
    </form>
  </section>
}
function Categories({ items, value, setValue, onAdd, onRemove }) { return <><div className="admin-title"><div><p className="admin-kicker">ORGANIZACIÓN</p><h1>Categorías</h1></div><p>Creá, editá o quitá las secciones que necesites para tu catálogo.</p></div><form className="category-form" onSubmit={onAdd}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nueva categoría" required /><button>Guardar <span>✓</span></button></form>{items.length ? <div className="category-list">{items.map((item) => <article key={item.id}><span>{item.name}</span><div className="admin-actions"><button onClick={() => editItem('categories', item.id)}>Editar</button><button onClick={() => onRemove('categories', item.id)}>Quitar</button></div></article>)}</div> : <Empty title="Usando categorías iniciales" text="Podés crear las tuyas desde arriba. Las sugeridas siguen disponibles para las primeras cargas." />}<StoreSettings /></> }
function StoreSettings() { const [phone, setPhone] = useState('1165937433'); const [notice, setNotice] = useState(''); useEffect(() => onSnapshot(doc(db, 'settings', 'store'), (snapshot) => { const stored = snapshot.data()?.whatsappNumber?.replace(/\D/g, ''); if (stored) setPhone(stored.replace(/^549/, '')) }, () => {}), []); const save = async (event) => { event.preventDefault(); const digits = phone.replace(/\D/g, ''); if (digits.length < 10) { setNotice('Ingresá un número válido con característica y celular.'); return } try { await setDoc(doc(db, 'settings', 'store'), { whatsappNumber: digits.startsWith('549') ? digits : `549${digits}`, updatedAt: serverTimestamp() }, { merge: true }); setNotice('Número de WhatsApp actualizado.') } catch { setNotice('No se pudo guardar el número.') } }; return <section className="store-settings"><p className="admin-kicker">CONTACTO</p><h2>WhatsApp de la tienda</h2><p>Este es el número al que llegan los pedidos de clientes.</p><form onSubmit={save}><label>Celular argentino<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" placeholder="11 6593 7433" /></label><button>Guardar número <span>✓</span></button></form>{notice && <small>{notice}</small>}</section> }
function Empty({ title, text }) { return <div className="admin-empty"><span>✦</span><h2>{title}</h2><p>{text}</p></div> }
