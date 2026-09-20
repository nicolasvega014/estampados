import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from './firebase'
import './Admin.css'

const DEFAULT_CATEGORIES = ['Anime', 'Flores', 'Mascotas', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']

function formatDate(value) {
  if (!value?.toDate) return 'Recién recibido'
  return value.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
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
  const [categories, setCategories] = useState([])
  const [upload, setUpload] = useState({ title: '', category: '', file: null })
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setLoading(false) }), [])

  useEffect(() => {
    if (!user) return undefined
    const stopOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar los pedidos.'))
    const stopDesigns = onSnapshot(query(collection(db, 'designs'), orderBy('createdAt', 'desc')), (snapshot) => setDesigns(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar los diseños.'))
    const stopCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setMessage('Todavía no se pudieron cargar las categorías.'))
    return () => { stopOrders(); stopDesigns(); stopCategories() }
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
      await addDoc(collection(db, 'categories'), { name, createdAt: serverTimestamp() })
      setCategoryName('')
      setMessage('Categoría agregada.')
    } catch { setMessage('No se pudo agregar la categoría.') }
  }

  async function addDesign(event) {
    event.preventDefault()
    if (!upload.file || !upload.category) { setMessage('Elegí una imagen y una categoría.'); return }
    setMessage('Subiendo diseño…')
    try {
      const cleanName = upload.file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const fileRef = ref(storage, `designs/${Date.now()}-${cleanName}`)
      await uploadBytes(fileRef, upload.file)
      const imageUrl = await getDownloadURL(fileRef)
      await addDoc(collection(db, 'designs'), { title: upload.title.trim() || upload.file.name, category: upload.category, imageUrl, createdAt: serverTimestamp() })
      setUpload({ title: '', category: '', file: null })
      event.target.reset()
      setMessage('Diseño publicado en el catálogo.')
    } catch { setMessage('No se pudo subir. Falta habilitar el almacenamiento o no tenés permisos.') }
  }

  async function remove(collectionName, id) {
    if (!window.confirm('¿Querés quitar este elemento?')) return
    try { await deleteDoc(doc(db, collectionName, id)); setMessage('Elemento eliminado.') }
    catch { setMessage('No se pudo eliminar el elemento.') }
  }

  if (loading) return <main className="admin-loading">Cargando panel…</main>

  if (!user) return <main className="admin-login"><a className="admin-brand" href="/">TINTA<span>•</span>CLUB</a><section><p className="admin-kicker">PANEL DEL VENDEDOR</p><h1>Administrá tu tienda.</h1><p>Ingresá con tu cuenta de vendedor para manejar el catálogo y los pedidos.</p><form onSubmit={login}><label>Correo<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label><label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>{message && <p className="admin-message">{message}</p>}<button>Ingresar al panel <span>→</span></button></form></section></main>

  return <main className="admin-page"><header className="admin-header"><a className="admin-brand" href="/">TINTA<span>•</span>CLUB</a><div><span>{user.email}</span><button className="admin-logout" onClick={() => signOut(auth)}>Salir</button></div></header><div className="admin-layout"><aside><p className="admin-kicker">ADMINISTRACIÓN</p><button className={active === 'pedidos' ? 'active' : ''} onClick={() => setActive('pedidos')}>Pedidos <b>{orders.length}</b></button><button className={active === 'disenos' ? 'active' : ''} onClick={() => setActive('disenos')}>Diseños <b>{designs.length}</b></button><button className={active === 'categorias' ? 'active' : ''} onClick={() => setActive('categorias')}>Categorías <b>{categories.length}</b></button><a href="/">Ver tienda <span>↗</span></a></aside><section className="admin-content">{message && <p className="admin-toast">{message}</p>}{active === 'pedidos' && <Orders orders={orders} />}{active === 'disenos' && <Designs designs={designs} upload={upload} setUpload={setUpload} categories={categoryOptions} onAdd={addDesign} onRemove={remove} />}{active === 'categorias' && <Categories items={categories} value={categoryName} setValue={setCategoryName} onAdd={addCategory} onRemove={remove} />}</section></div></main>
}

function Orders({ orders }) { return <><div className="admin-title"><div><p className="admin-kicker">VENTAS</p><h1>Pedidos</h1></div><p>Acá vas a ver los pedidos confirmados por tus clientes.</p></div>{orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}><div><b>#{order.id.slice(0, 6).toUpperCase()}</b><span>{formatDate(order.createdAt)}</span></div><h2>{order.customerName || 'Pedido de remera personalizada'}</h2><p>{order.size || 'Talle sin indicar'} · {order.color || 'Color sin indicar'} · {order.status || 'Nuevo'}</p></article>)}</div> : <Empty title="Todavía no hay pedidos" text="Cuando conectemos el botón de compra, los pedidos van a aparecer acá." />}</> }
function Designs({ designs, upload, setUpload, categories, onAdd, onRemove }) { return <><div className="admin-title"><div><p className="admin-kicker">CATÁLOGO</p><h1>Diseños</h1></div><p>Subí una imagen y elegí la categoría donde querés mostrarla.</p></div><form className="upload-form" onSubmit={onAdd}><label>Imagen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} required /></label><label>Nombre<input value={upload.title} onChange={(event) => setUpload({ ...upload, title: event.target.value })} placeholder="Ej. Gato con anteojos" /></label><label>Categoría<select value={upload.category} onChange={(event) => setUpload({ ...upload, category: event.target.value })} required><option value="">Elegí una</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><button>Subir diseño <span>↑</span></button></form>{designs.length ? <div className="design-grid">{designs.map((design) => <article key={design.id}><img src={design.imageUrl} alt={design.title} /><div><span>{design.category}</span><h2>{design.title}</h2><button onClick={() => onRemove('designs', design.id)}>Quitar</button></div></article>)}</div> : <Empty title="Aún no subiste diseños" text="Los diseños que publiques desde acá se van a organizar por categoría." />}</> }
function Categories({ items, value, setValue, onAdd, onRemove }) { return <><div className="admin-title"><div><p className="admin-kicker">ORGANIZACIÓN</p><h1>Categorías</h1></div><p>Creá y quitá las secciones que necesites para tu catálogo.</p></div><form className="category-form" onSubmit={onAdd}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nueva categoría" required /><button>Agregar <span>+</span></button></form>{items.length ? <div className="category-list">{items.map((item) => <article key={item.id}><span>{item.name}</span><button onClick={() => onRemove('categories', item.id)}>Quitar</button></article>)}</div> : <Empty title="Usando categorías iniciales" text="Podés crear las tuyas desde arriba. Las sugeridas siguen disponibles para las primeras cargas." />}</> }
function Empty({ title, text }) { return <div className="admin-empty"><span>✦</span><h2>{title}</h2><p>{text}</p></div> }
