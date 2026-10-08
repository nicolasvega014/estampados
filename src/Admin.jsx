import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { DEFAULT_CUSTOMIZER_COLORS, DEFAULT_CUSTOMIZER_SIZES, normalizeCustomizerSettings } from './customizerSettings'
import './Admin.css'
import './AdminProducts.css'
import './AdminStoreSettings.css'
import './CustomizerSettings.css'

const DEFAULT_CATEGORIES = ['Anime', 'Flores', 'Mascotas', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
const EMPTY_PRODUCT = { title: '', description: '', price: '18900', category: '', imageUrl: '', imagePublicId: '', imageFile: null, id: '' }
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function formatDate(value) {
  if (!value?.toDate) return 'Recién recibido'
  return value.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
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

  return <main className="admin-page"><header className="admin-header"><a className="admin-brand" href="/">TINTA<span>•</span>CLUB</a><div><span>{user.email}</span><button className="admin-logout" onClick={() => signOut(auth)}>Salir</button></div></header><div className="admin-layout"><aside><p className="admin-kicker">ADMINISTRACIÓN</p><button className={active === 'pedidos' ? 'active' : ''} onClick={() => setActive('pedidos')}>Pedidos <b>{orders.length}</b></button><button className={active === 'productos' ? 'active' : ''} onClick={() => setActive('productos')}>Productos <b>{products.length}</b></button><button className={active === 'disenos' ? 'active' : ''} onClick={() => setActive('disenos')}>Diseños <b>{designs.length}</b></button><button className={active === 'personalizador' ? 'active' : ''} onClick={() => setActive('personalizador')}>Personalizador</button><button className={active === 'categorias' ? 'active' : ''} onClick={() => setActive('categorias')}>Categorías <b>{categories.length}</b></button><a href="/">Ver tienda <span>↗</span></a></aside><section className="admin-content">{message && <p className="admin-toast">{message}</p>}{active === 'pedidos' && <Orders orders={orders} />}{active === 'productos' && <Products items={products} value={product} setValue={setProduct} categories={categoryOptions} onAdd={addProduct} onRemove={remove} />}{active === 'disenos' && <Designs designs={designs} upload={upload} setUpload={setUpload} categories={categoryOptions} onAdd={addDesign} onRemove={remove} />}{active === 'personalizador' && <CustomizerSettings />}{active === 'categorias' && <Categories items={categories} value={categoryName} setValue={setCategoryName} onAdd={addCategory} onRemove={remove} />}</section></div></main>
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
