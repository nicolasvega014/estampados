import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { animate, inView } from 'motion'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import Shirt3D from './Shirt3D'
import Admin from './Admin'
import { db } from './firebase'
import './App.css'
import './ProductCatalog.css'
import './CartCheckout.css'
import './StoreFooter.css'

const COLORS = [{ name: 'Blanco', value: '#f7f6f2' }, { name: 'Negro', value: '#1e1e21' }, { name: 'Arena', value: '#d9d0c3' }, { name: 'Verde', value: '#71866c' }, { name: 'Bordó', value: '#7d3541' }]
const SIZES = ['S', 'M', 'L', 'XL', 'XXL']
const SHIRT_PRICE = 18900
const DEFAULT_WHATSAPP = '5491165937433'

function CartDrawer({ open, items, onClose, onRemove, onQuantity }) {
  const [customer, setCustomer] = useState({ name: '', delivery: 'Retiro por el local', address: '', notes: '' })
  const total = items.reduce((sum, item) => sum + Number(item.price || SHIRT_PRICE) * item.quantity, 0)
  const updateCustomer = (key, value) => setCustomer((current) => ({ ...current, [key]: value }))
  const details = items.map((item, index) => {
    const base = `${index + 1}. ${item.title || 'Remera personalizada'} × ${item.quantity}`
    if (item.kind === 'product') return `${base}\n${item.category || 'Producto'}${item.description ? ` · ${item.description}` : ''}`
    return `${base}\nColor: ${item.color}\nTalle: ${item.size}\nFrente: ${item.front || 'sin diseño'}\nEspalda: ${item.back || 'sin diseño'}`
  }).join('\n\n')
  const customerDetails = `${customer.name ? `\n\nNombre: ${customer.name}` : ''}\nEntrega: ${customer.delivery}${customer.delivery === 'Envío a domicilio' && customer.address ? `\nDirección: ${customer.address}` : ''}${customer.notes ? `\nNotas: ${customer.notes}` : ''}`
  const message = encodeURIComponent(`Hola, quiero confirmar mi pedido de Tinta Club.\n\n${details}${customerDetails}\n\nTotal: $ ${total.toLocaleString('es-AR')}\n\nImportante: si tu pedido incluye una remera personalizada, adjuntá el diseño original como documento (no como foto) para conservar la calidad de impresión DTF.`)
  return <div className={`cart-layer ${open ? 'is-open' : ''}`} aria-hidden={!open}><button className="cart-backdrop" aria-label="Cerrar bolsa" onClick={onClose}/><aside className="cart-drawer" aria-label="Tu bolsa"><header><div><p className="eyebrow">TU COMPRA</p><h2>Bolsa</h2></div><button onClick={onClose} aria-label="Cerrar bolsa">×</button></header>{items.length ? <><div className="cart-items">{items.map((item) => { const price = Number(item.price || SHIRT_PRICE); const isCatalogProduct = item.kind === 'product'; return <article className="cart-item" key={item.id}><div className="cart-item-art">{isCatalogProduct && item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span style={{ background: item.colorValue || '#e6e4de' }}/>}</div><div><h3>{item.title || 'Remera personalizada'}</h3><p>{isCatalogProduct ? item.category || 'Producto del catálogo' : `${item.color} · Talle ${item.size}`}</p><small>{isCatalogProduct ? item.description || 'Producto de Tinta Club' : `${item.front ? `Frente: ${item.front}` : ''}${item.back ? ` · Espalda: ${item.back}` : ''}`}</small><div className="quantity"><button onClick={() => onQuantity(item.id, item.quantity - 1)} aria-label="Restar una unidad">−</button><b>{item.quantity}</b><button onClick={() => onQuantity(item.id, item.quantity + 1)} aria-label="Sumar una unidad">+</button><button className="remove-cart-item" onClick={() => onRemove(item.id)}>Quitar</button></div></div><strong>$ {(price * item.quantity).toLocaleString('es-AR')}</strong></article>})}</div><footer className="cart-footer"><div><span>Total</span><strong>$ {total.toLocaleString('es-AR')}</strong></div><div className="cart-customer"><label>Tu nombre<input value={customer.name} onChange={(event) => updateCustomer('name', event.target.value)} placeholder="Opcional" /></label><label>Entrega<select value={customer.delivery} onChange={(event) => updateCustomer('delivery', event.target.value)}><option>Retiro por el local</option><option>Envío a domicilio</option></select></label>{customer.delivery === 'Envío a domicilio' && <label className="cart-wide">Dirección<input value={customer.address} onChange={(event) => updateCustomer('address', event.target.value)} placeholder="Calle, altura y localidad" /></label>}<label className="cart-wide">Notas para el pedido<textarea value={customer.notes} onChange={(event) => updateCustomer('notes', event.target.value)} placeholder="Ej. Necesito recibirlo antes del viernes" rows="2" /></label></div><a href={`https://wa.me/${window.tintaWhatsApp || DEFAULT_WHATSAPP}?text=${message}`} target="_blank" rel="noreferrer">Continuar por WhatsApp <span>→</span></a><p>Revisaremos tu pedido y coordinaremos el pago por WhatsApp.</p></footer></> : <div className="empty-cart"><span>◌</span><h3>Tu bolsa está vacía.</h3><p>Personalizá una remera o elegí un producto del catálogo.</p><button onClick={onClose}>Seguir viendo la tienda</button></div>}</aside></div>
}

function Shirt({ color, design, transform, side, onPointerDown, onDesignPointerDown }) {
  const designPointerDown = onDesignPointerDown || onPointerDown
  return <Shirt3D color={color} design={design} side={side} transform={transform} onDesignPointerDown={designPointerDown}/>
  const isBack = side === 'Espalda'
  return <div className={`shirt-stage ${isBack ? 'back' : 'front'}`}><svg className="shirt" viewBox="0 0 360 440" aria-label={`Remera ${color.name}, vista ${side}`}><defs><linearGradient id="fabric" x1="0" x2=".9" y1="0" y2="1"><stop stopColor={color.value}/><stop offset=".72" stopColor={color.value}/><stop offset="1" stopColor={color.value} stopOpacity=".88"/></linearGradient><linearGradient id="light" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" stopOpacity=".3"/><stop offset=".6" stopColor="#fff" stopOpacity="0"/></linearGradient></defs><path className="shirt-body" d="M110 47 70 66 18 116l47 70 46-30v250c43 9 101 9 138 0V156l46 30 47-70-52-50-40-19c-13 23-39 34-70 34s-57-11-70-34Z" fill="url(#fabric)"/><path className="shirt-highlight" d="M110 47 70 66 18 116l47 70 46-30v250c20 4 45 6 69 6V82c-31 0-57-11-70-35Z" fill="url(#light)"/><path className="sleeve-seam" d="m70 66 41 47m179-47-41 47"/><path className="side-seam" d="M111 156v250m138-250v250"/>{isBack ? <><path className="collar back-collar" d="M116 51c13 25 99 25 128 0"/><path className="back-yoke" d="M91 101c55 18 123 18 178 0"/></> : <><path className="collar" d="M110 47c14 45 126 45 140 0"/><path className="front-fold" d="M180 82v31"/></>}<path className="hem" d="M111 406c43 9 101 9 138 0"/></svg><div className="print-area" aria-label={`Área de estampado de la ${side.toLowerCase()}`}>{design ? <img className="user-design" src={design} alt="Diseño cargado" onPointerDown={onPointerDown} style={{ width: `${transform.scale}%`, left: `${transform.x}%`, top: `${transform.y}%`, transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)` }}/> : <div className="drop-hint"><span>+</span> Tu diseño</div>}</div></div>
}

function ProductCatalog({ products }) {
  if (!products.length) return null
  return <section className="product-catalog" id="productos"><div className="product-catalog-head"><div><p className="eyebrow">CATÁLOGO</p><h2>Elegí tu próxima remera.</h2></div><p>Estas prendas ya están listas para que las descubras. Podés elegir una y personalizarla a tu manera.</p></div><div className="store-product-grid">{products.map((product) => <article className="store-product" key={product.id}><div className="store-product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" /> : <div className="store-product-placeholder"><span>TINTA<br/>CLUB</span><small>PRENDA PERSONALIZABLE</small></div>}</div><div className="store-product-info"><span>{product.category || 'Remeras'}</span><h3>{product.title}</h3>{product.description && <p>{product.description}</p>}<div><strong>$ {Number(product.price || 0).toLocaleString('es-AR')}</strong><a href="/personaliza">Personalizar <b>→</b></a></div></div></article>)}</div></section>
}

function App() {
  if (window.location.pathname === '/admin') return <Admin />
  const [color, setColor] = useState(COLORS[0]); const [size, setSize] = useState('M'); const [side, setSide] = useState('Frente'); const [designs, setDesigns] = useState({ Frente: '', Espalda: '' }); const [fileNames, setFileNames] = useState({ Frente: '', Espalda: '' }); const [notice, setNotice] = useState(''); const [transforms, setTransforms] = useState({ Frente: { x: 50, y: 43, scale: 54, rotation: 0 }, Espalda: { x: 50, y: 43, scale: 54, rotation: 0 } }); const transform = transforms[side]; const setTransform = (next) => setTransforms((current) => { const active = current[side]; return { ...current, [side]: typeof next === 'function' ? next(active) : next } }); const drag = useRef(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState(() => { try { return JSON.parse(window.localStorage.getItem('tinta-club-cart') || '[]') } catch { return [] } })
  const [products, setProducts] = useState([])
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP)
  const cartRoot = useRef(null)
  const activeTransform = useRef(transform)
  const pinch = useRef(null)
  const design = designs[side]
  const fileName = fileNames[side]
  const isCustomizerPage = window.location.pathname === '/personaliza'
  useEffect(() => {
    document.querySelectorAll('nav a').forEach((link) => { if (link.textContent === 'Cómo funciona') link.remove() })
    document.querySelectorAll('header nav').forEach((nav) => {
      if (nav.querySelector('a[href="#productos"], a[href="/#productos"]')) return
      const link = document.createElement('a')
      link.href = isCustomizerPage ? '/#productos' : '#productos'
      link.textContent = 'Productos'
      nav.insertBefore(link, nav.children[1] || null)
    })
    const designSizeRange = document.querySelector('.range')
    if (designSizeRange) designSizeRange.min = '5'
    document.querySelectorAll('a[href="#personaliza"]').forEach((link) => { link.href = '/personaliza' })
    document.querySelectorAll('a[href="#como-funciona"], a[href="/#como-funciona"]').forEach((link) => { link.href = '/personaliza' })
  }, [])
  useEffect(() => { window.localStorage.setItem('tinta-club-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    const stop = onSnapshot(doc(db, 'settings', 'store'), (snapshot) => {
      const number = snapshot.data()?.whatsappNumber?.replace(/\D/g, '')
      if (number) setWhatsappNumber(number)
    }, () => {})
    return () => stop()
  }, [])
  useEffect(() => { window.tintaWhatsApp = whatsappNumber }, [whatsappNumber])
  useEffect(() => {
    if (isCustomizerPage) return undefined
    const after = document.querySelector('.how')
    if (!after) return undefined
    const footer = document.querySelector('.store-footer') || document.createElement('footer')
    footer.className = 'store-footer'
    const localNumber = whatsappNumber.replace(/^549/, '')
    footer.innerHTML = `<div class="footer-newsletter"><div><p class="eyebrow">NOVEDADES FENIXIS</p><h2>Ideas nuevas.<br><em>Directo a vos.</em></h2></div><form class="footer-form"><label class="sr-only" for="footer-email">Tu email</label><input id="footer-email" type="email" placeholder="Tu email" required><button>Quiero enterarme <span>→</span></button><small>Diseños, lanzamientos y promos. Sin spam.</small></form></div><div class="footer-main"><div class="footer-brand"><a href="#inicio">FENIXIS<span>•</span>STUDIO</a><p>Remeras personalizadas para llevar tus ideas a donde vayas.</p></div><div><p class="footer-label">EXPLORÁ</p><a href="#inicio">Inicio</a><a href="#productos">Productos</a><a href="/personaliza">Personalizá</a></div><div><p class="footer-label">CONTACTO</p><a class="footer-whatsapp" href="https://wa.me/${whatsappNumber}" target="_blank" rel="noreferrer">WhatsApp <span>${localNumber}</span></a><p>Buenos Aires, Argentina</p><a href="/admin">Acceso vendedor ↗</a></div></div><div class="footer-bottom"><span>© 2026 FENIXIS. Todos los derechos reservados.</span><span>Hecho para crear sin límites.</span></div>`
    footer.querySelector('.footer-newsletter')?.remove()
    footer.querySelector('a[href="/admin"]')?.remove()
    const contact = footer.querySelector('.footer-main > div:last-child')
    const socials = document.createElement('div')
    socials.className = 'footer-socials'
    socials.innerHTML = '<a href="https://www.instagram.com/fenixisstore/" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://www.tiktok.com/@fenixisstore" target="_blank" rel="noreferrer">TikTok ↗</a>'
    contact.insertBefore(socials, contact.querySelector('.footer-whatsapp'))
    if (!footer.parentElement) after.insertAdjacentElement('afterend', footer)
    return undefined
  }, [isCustomizerPage, whatsappNumber])
  useEffect(() => {
    if (isCustomizerPage) return undefined
    return onSnapshot(collection(db, 'products'), (snapshot) => {
      const visibleProducts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      visibleProducts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setProducts(visibleProducts)
    }, () => setProducts([]))
  }, [isCustomizerPage])
  useEffect(() => {
    if (isCustomizerPage) return undefined
    const oldSection = document.querySelector('.product-catalog')
    if (!products.length) { oldSection?.remove(); return undefined }
    const featured = document.querySelector('.featured')
    if (!featured) return undefined
    const section = oldSection || document.createElement('section')
    section.className = 'product-catalog'; section.id = 'productos'
    if (!oldSection) featured.before(section)
    const head = document.createElement('div'); head.className = 'product-catalog-head'
    const title = document.createElement('div'); const eyebrow = document.createElement('p'); const heading = document.createElement('h2'); const copy = document.createElement('p')
    eyebrow.className = 'eyebrow'; eyebrow.textContent = 'CATÁLOGO'; heading.textContent = 'Elegí tu próxima remera.'; copy.textContent = 'Estas prendas ya están listas para que las descubras. Elegí una y personalizala a tu manera.'
    title.append(eyebrow, heading); head.append(title, copy)
    const grid = document.createElement('div'); grid.className = 'store-product-grid'
    products.forEach((product) => {
      const card = document.createElement('article'); card.className = 'store-product'
      const imageBox = document.createElement('div'); imageBox.className = 'store-product-image'
      if (product.imageUrl) { const image = document.createElement('img'); image.src = product.imageUrl; image.alt = product.title; image.loading = 'lazy'; imageBox.append(image) } else { const placeholder = document.createElement('div'); const stamp = document.createElement('span'); const note = document.createElement('small'); placeholder.className = 'store-product-placeholder'; stamp.innerHTML = 'TINTA<br>CLUB'; note.textContent = 'PRENDA PERSONALIZABLE'; placeholder.append(stamp, note); imageBox.append(placeholder) }
      const info = document.createElement('div'); info.className = 'store-product-info'
      const category = document.createElement('span'); const name = document.createElement('h3'); const priceLine = document.createElement('div'); const price = document.createElement('strong'); const actions = document.createElement('span'); const link = document.createElement('a'); const add = document.createElement('button')
      category.textContent = product.category || 'Remeras'; name.textContent = product.title; price.textContent = `$ ${Number(product.price || 0).toLocaleString('es-AR')}`; link.href = '/personaliza'; link.innerHTML = 'Personalizar <b>→</b>'; actions.className = 'store-product-actions'; add.type = 'button'; add.textContent = 'Agregar'; add.addEventListener('click', () => window.dispatchEvent(new CustomEvent('tinta-add-catalog-product', { detail: product }))); actions.append(link, add)
      info.append(category, name)
      if (product.description) { const description = document.createElement('p'); description.textContent = product.description; info.append(description) }
      priceLine.append(price, actions); info.append(priceLine); card.append(imageBox, info); grid.append(card)
    })
    section.replaceChildren(head, grid)
    return undefined
  }, [products, isCustomizerPage])
  useEffect(() => { activeTransform.current = transform }, [transform])
  useEffect(() => {
    const host = document.createElement('div')
    host.className = 'cart-root'
    document.body.append(host)
    cartRoot.current = createRoot(host)
    return () => { cartRoot.current?.unmount(); host.remove() }
  }, [])
  useEffect(() => {
    if (!isCustomizerPage) return
    const savedDesign = window.localStorage.getItem('tinta-club-selected-design')
    if (!savedDesign) return
    try {
      const design = JSON.parse(savedDesign)
      if (!design?.src?.startsWith('/designs/')) return
      setDesigns((current) => ({ ...current, Frente: design.src }))
      setFileNames((current) => ({ ...current, Frente: design.name }))
      setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })
      setNotice(`Diseño “${design.name}” listo para acomodar en el frente.`)
    } finally {
      window.localStorage.removeItem('tinta-club-selected-design')
    }
  }, [isCustomizerPage])
  useEffect(() => {
    if (!isCustomizerPage) return
    const upload = document.querySelector('.controls .upload')
    if (!upload) return
    const openButton = document.createElement('button')
    const picker = document.createElement('section')
    openButton.type = 'button'; openButton.className = 'browse-designs'; openButton.textContent = 'Ver diseños de la galería →'
    picker.className = 'design-picker'; picker.hidden = true
    picker.innerHTML = '<div class="design-picker-head"><strong>Elegí un diseño</strong><button type="button" aria-label="Cerrar diseños">×</button></div><div class="picker-filters"></div><div class="picker-grid"></div>'
    upload.insertAdjacentElement('afterend', openButton); openButton.insertAdjacentElement('afterend', picker)
    const closeButton = picker.querySelector('.design-picker-head button')
    const filters = picker.querySelector('.picker-filters')
    const grid = picker.querySelector('.picker-grid')
    const categories = ['Todo', 'Mascotas', 'Flores', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
    let availableDesigns = []
    const render = (category = 'Todo') => {
      grid.replaceChildren()
      const visible = (category === 'Todo' ? availableDesigns : availableDesigns.filter((design) => design.category === category)).slice(0, 30)
      visible.forEach((design) => {
        const option = document.createElement('button'); const image = document.createElement('img'); const label = document.createElement('span')
        option.type = 'button'; option.dataset.src = design.src; option.dataset.name = design.name
        image.src = design.src; image.alt = design.name; image.loading = 'lazy'; label.textContent = design.name
        option.append(image, label); grid.append(option)
      })
    }
    categories.forEach((category, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = category; button.className = index === 0 ? 'active' : ''; button.addEventListener('click', () => { filters.querySelectorAll('button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); render(category) }); filters.append(button) })
    const openPicker = () => { picker.hidden = false; render(filters.querySelector('.active')?.textContent || 'Todo') }
    const closePicker = () => { picker.hidden = true }
    const chooseDesign = (event) => { const option = event.target.closest('[data-src]'); if (!option) return; const name = option.dataset.name; setDesigns((current) => ({ ...current, [side]: option.dataset.src })); setFileNames((current) => ({ ...current, [side]: name })); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }); setNotice(`Diseño “${name}” cargado en ${side.toLowerCase()}. Podés moverlo directamente sobre la remera.`); closePicker() }
    openButton.addEventListener('click', openPicker); closeButton.addEventListener('click', closePicker); grid.addEventListener('click', chooseDesign)
    fetch('/designs/manifest.json').then((response) => response.json()).then((items) => { availableDesigns = items; render() }).catch(() => {})
    return () => { openButton.removeEventListener('click', openPicker); closeButton.removeEventListener('click', closePicker); grid.removeEventListener('click', chooseDesign); openButton.remove(); picker.remove() }
  }, [isCustomizerPage, side])
  useEffect(() => {
    if (isCustomizerPage || document.querySelector('.collections')) return
    const featured = document.querySelector('.featured')
    if (!featured) return
    featured.insertAdjacentHTML('afterend', `<section class="collections" id="colecciones"><aside class="collections-nav"><p class="eyebrow">EXPLORÁ POR ESTILO</p><h2>Colecciones</h2><div class="collection-links"><button class="active">Todo</button><button>Anime</button><button>Flores</button><button>Gaming</button><button>Música</button><button>Deportes</button><button>Autos & motos</button><button>Mascotas</button><button>Frases</button></div></aside><div class="collection-content"><div class="collection-heading"><div><p class="eyebrow">DISEÑOS LISTOS PARA USAR</p><h2>Encontrá tu estilo.</h2></div><p>Elegí una colección o subí tu propio arte para crear una remera única.</p></div><div class="collection-grid"><article><img src="https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=800&q=80" alt="Colección Anime"/><span>ANIME</span></article><article><img src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=80" alt="Colección Flores"/><span>FLORES</span></article><article><img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80" alt="Colección Gaming"/><span>GAMING</span></article><article><img src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80" alt="Colección Música"/><span>MÚSICA</span></article><article><img src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80" alt="Colección Deportes"/><span>DEPORTES</span></article><article><img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80" alt="Colección Autos y motos"/><span>AUTOS & MOTOS</span></article><article><img src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80" alt="Colección Mascotas"/><span>MASCOTAS</span></article><article class="quote-card"><p>"HACÉ LUGAR<br/>PARA LO<br/>QUE TE<br/>HACE VOS."</p><span>FRASES</span></article></div></div></section>`)
    const buttons = document.querySelectorAll('.collection-links button')
    const categories = ['Todo', 'Mascotas', 'Flores', 'Verano', 'Coquette', 'Frases', 'Moda', 'Vintage']
    const grid = document.querySelector('.collection-grid')
    const heading = document.querySelector('.collection-heading h2')
    let designs = []
    let cancelled = false
    buttons.forEach((button, index) => { if (categories[index]) button.textContent = categories[index]; else button.remove() })
    const renderCollection = (category) => {
      if (!grid) return
      grid.replaceChildren()
      const visibleDesigns = (category === 'Todo' ? designs : designs.filter((design) => design.category === category)).slice(0, 24)
      visibleDesigns.forEach((design) => {
        const card = document.createElement('article')
        const image = document.createElement('img')
        const label = document.createElement('span')
        image.src = design.src; image.alt = design.name; image.loading = 'lazy'
        label.textContent = design.name.toUpperCase()
        card.className = 'collection-card'; card.append(image, label); card.addEventListener('click', () => { window.localStorage.setItem('tinta-club-selected-design', JSON.stringify(design)); window.location.assign('/personaliza') }); grid.append(card)
      })
      if (heading) heading.textContent = category === 'Todo' ? 'Encontrá tu estilo.' : category
    }
    fetch('/designs/manifest.json').then((response) => response.json()).then((items) => { if (!cancelled) { designs = items; renderCollection('Todo') } }).catch(() => {})
    const select = (event) => { buttons.forEach((button) => button.classList.remove('active')); event.currentTarget.classList.add('active'); renderCollection(event.currentTarget.textContent) }
    buttons.forEach((button) => button.addEventListener('click', select))
    return () => { cancelled = true; buttons.forEach((button) => button.removeEventListener('click', select)) }
  }, [isCustomizerPage])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const first = isCustomizerPage ? document.querySelector('.editor-page .standalone') : document.querySelector('.landing')
    const intro = isCustomizerPage ? document.querySelector('.editor-page .customizer-intro') : document.querySelector('.hero-photo')
    const running = []
    if (first) running.push(animate(first, { opacity: [0, 1], y: [18, 0] }, { duration: .58, ease: [.22, 1, .36, 1] }))
    if (intro) running.push(animate(intro, { opacity: [0, 1], y: [14, 0] }, { duration: .62, delay: .1, ease: [.22, 1, .36, 1] }))
    const stopWatching = inView('.product-catalog, .featured, .collections, .how', (element) => animate(element, { opacity: [0, 1], y: [24, 0] }, { duration: .55, ease: [.22, 1, .36, 1] }), { margin: '0px 0px -8% 0px' })
    return () => { running.forEach((animation) => animation.stop()); stopWatching() }
  }, [isCustomizerPage])
  const whatsappMessage = useMemo(() => encodeURIComponent(`Hola, quiero pedir una remera personalizada.\nColor: ${color.name}\nTalle: ${size}\nDiseño frente: ${fileNames.Frente || 'sin diseño'}\nDiseño espalda: ${fileNames.Espalda || 'sin diseño'}\n\nImportante: voy a adjuntar mi diseño original como documento (no como foto) para conservar la calidad de impresión DTF.`), [color, fileNames, size])
  useEffect(() => {
    document.querySelectorAll('.order').forEach((link) => { link.href = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}` })
  }, [whatsappNumber, whatsappMessage])
  function addToCart() { if (!designs.Frente && !designs.Espalda) { setNotice('Primero agregá al menos un diseño a la remera.'); return } const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: 'custom', title: 'Remera personalizada', price: SHIRT_PRICE, color: color.name, colorValue: color.value, size, front: fileNames.Frente, back: fileNames.Espalda, quantity: 1 }; setCart((current) => [...current, item]); setDesigns({ Frente: '', Espalda: '' }); setFileNames({ Frente: '', Espalda: '' }); setTransforms({ Frente: { x: 50, y: 43, scale: 54, rotation: 0 }, Espalda: { x: 50, y: 43, scale: 54, rotation: 0 } }); setColor(COLORS[0]); setSize('M'); setSide('Frente'); setCartOpen(false); setNotice('Remera agregada a la bolsa. Ya podés personalizar otra.') }
  function addCatalogProduct(product) { if (!product) return; const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: 'product', title: product.title || 'Producto', price: Number(product.price || 0), category: product.category || 'Producto del catálogo', description: product.description || '', imageUrl: product.imageUrl || '', quantity: 1 }; setCart((current) => [...current, item]); setCartOpen(true) }
  function removeCartItem(id) { setCart((current) => current.filter((item) => item.id !== id)) }
  function updateQuantity(id, quantity) { if (quantity < 1) return removeCartItem(id); setCart((current) => current.map((item) => item.id === id ? { ...item, quantity } : item)) }
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  useEffect(() => {
    const add = (event) => addCatalogProduct(event.detail)
    window.addEventListener('tinta-add-catalog-product', add)
    return () => window.removeEventListener('tinta-add-catalog-product', add)
  }, [])
  useEffect(() => {
    cartRoot.current?.render(<CartDrawer open={cartOpen} items={cart} onClose={() => setCartOpen(false)} onRemove={removeCartItem} onQuantity={updateQuantity}/>)
  }, [cartOpen, cart, whatsappNumber])
  useEffect(() => {
    const openCart = () => setCartOpen(true)
    const addProduct = (event) => { event.preventDefault(); addToCart() }
    const buttons = [...document.querySelectorAll('.cart')]
    const orders = [...document.querySelectorAll('.order')]
    buttons.forEach((button) => { const count = button.querySelector('span'); if (count) count.textContent = cartCount; button.addEventListener('click', openCart) })
    const addButtons = orders.map((order) => {
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'add-to-cart'; button.innerHTML = 'Agregar a la bolsa <span>+</span>'
      button.addEventListener('click', addProduct)
      order.insertAdjacentElement('beforebegin', button)
      return button
    })
    return () => { buttons.forEach((button) => button.removeEventListener('click', openCart)); addButtons.forEach((button) => { button.removeEventListener('click', addProduct); button.remove() }) }
  }, [cartCount, color, size, designs, fileNames])
  useEffect(() => {
    if (!design) return undefined
    const help = document.querySelector('.drag-help')
    if (help) help.textContent = 'Arrastrá el diseño o usá dos dedos para cambiar su tamaño'
    const startPinch = () => { drag.current = null; pinch.current = Number(activeTransform.current.scale) }
    const resizeWithPinch = (event) => {
      if (!pinch.current) return
      const scale = Math.max(5, Math.min(90, Math.round(pinch.current * event.detail.ratio)))
      setTransform((current) => ({ ...current, scale }))
    }
    const finishPinch = () => { pinch.current = null }
    window.addEventListener('tinta-club-pinch-start', startPinch)
    window.addEventListener('tinta-club-pinch', resizeWithPinch)
    window.addEventListener('tinta-club-pinch-end', finishPinch)
    return () => { window.removeEventListener('tinta-club-pinch-start', startPinch); window.removeEventListener('tinta-club-pinch', resizeWithPinch); window.removeEventListener('tinta-club-pinch-end', finishPinch) }
  }, [design, side])
  function uploadDesign(event) { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setNotice('Elegí una imagen JPG, PNG o WEBP.'); return } if (file.size > 10 * 1024 * 1024) { setNotice('La imagen no puede superar 10 MB.'); return } const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { setDesigns(current => ({ ...current, [side]: url })); setFileNames(current => ({ ...current, [side]: file.name })); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }); setNotice(image.width < 1000 || image.height < 1000 ? 'Atención: la imagen podría verse pixelada al estampar. Recomendamos al menos 1000 px.' : `¡Diseño cargado en ${side.toLowerCase()}! Podés moverlo directamente sobre la remera.`) }; image.src = url }
  function removeDesign() { setDesigns(current => ({ ...current, [side]: '' })); setFileNames(current => ({ ...current, [side]: '' })); setNotice(`Imagen de ${side.toLowerCase()} eliminada. Podés subir otra cuando quieras.`); setTransform({ x: 50, y: 43, scale: 54, rotation: 0 }) }
  function startDrag(event) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, startX: transform.x, startY: transform.y } }
  function moveDrag(event) { if (!drag.current) return; const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(10, Math.min(90, drag.current.startX + ((event.clientX - drag.current.x) / rect.width) * 100)); const y = Math.max(10, Math.min(90, drag.current.startY + ((event.clientY - drag.current.y) / rect.height) * 100)); setTransform(current => ({ ...current, x, y })) }
  function endDrag() { drag.current = null }
  if (isCustomizerPage) return <main className="editor-page"><header><a className="brand" href="/">TINTA<span>•</span>CLUB</a><nav><a href="/">Inicio</a><a href="/#productos">Productos</a><a className="current-nav" href="/personaliza">Personalizá</a><a href="/#como-funciona">Cómo funciona</a></nav><button className="cart" type="button">Bolsa <span>0</span></button></header><section className="customizer-section standalone" id="personaliza"><div className="customizer-intro"><div><p className="eyebrow">CREÁ TU PRENDA</p><h2>Personalizá tu remera.</h2></div><p>Subí tu diseño, acomodalo y mandanos tu pedido.</p></div><section className="customizer" aria-label="Personalizador de remera"><aside className="controls"><div className="step"><span>01</span><div><h2>Tu diseño</h2><p>PNG, JPG o WEBP · Máx. 10 MB</p></div></div><label className="upload" htmlFor="design-upload"><strong>{design ? 'Cambiar imagen' : 'Subir imagen'}</strong><small>{fileName || 'Elegí el archivo de tu dispositivo'}</small></label><input id="design-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadDesign}/>{design && <button className="remove-image" type="button" onClick={removeDesign}>× Quitar imagen</button>}{notice && <p className={`notice ${notice.startsWith('Atención') ? 'warning' : ''}`}>{notice}</p>}<div className="step separation"><span>02</span><div><h2>Personalizá</h2><p>Ajustá tu prenda</p></div></div><div className="option"><label>Color <b>{color.name}</b></label><div className="swatches">{COLORS.map(item => <button key={item.name} title={item.name} aria-label={item.name} className={color.name === item.name ? 'selected' : ''} onClick={() => setColor(item)} style={{ backgroundColor: item.value }}/>)}</div></div><div className="option"><label>Lado</label><div className="choice">{['Frente', 'Espalda'].map(item => <button key={item} onClick={() => setSide(item)} className={side === item ? 'active' : ''}>{item}</button>)}</div></div><div className="option"><label>Talle</label><div className="sizes">{SIZES.map(item => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div></aside><section className="preview"><div className="preview-top"><span>VISTA {side.toUpperCase()}</span><span className="print-label">ÁREA MÁXIMA 30 × 40 CM</span></div><div className="canvas" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><Shirt color={color} design={design} transform={transform} side={side} onDesignPointerDown={startDrag}/></div><p className="drag-help">{design ? 'Arrastrá el diseño para reposicionarlo' : 'Tu diseño aparecerá en esta zona'}</p></section><aside className="adjustments"><h2>Ajustes del diseño</h2><p className="adjust-copy">Usá los controles para dejarlo perfecto.</p><label className="range-label">Tamaño <output>{transform.scale}%</output></label><input className="range" type="range" min="20" max="90" value={transform.scale} onChange={event => setTransform({ ...transform, scale: event.target.value })}/><label className="range-label">Rotación <output>{transform.rotation}°</output></label><input className="range" type="range" min="-180" max="180" value={transform.rotation} onChange={event => setTransform({ ...transform, rotation: event.target.value })}/><button className="reset" onClick={() => setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })}>↺ Restablecer posición</button><div className="summary"><span>Remera personalizada</span><strong>$ 18.900</strong><small>El precio final puede variar según el diseño.</small></div><a className="order" href={`https://wa.me/5491100000000?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Pedir por WhatsApp <span>→</span></a></aside></section></section></main>
  return <main><header><a className="brand" href="#inicio">TINTA<span>•</span>CLUB</a><nav><a href="#inicio">Inicio</a><a href="#personaliza">Personalizá</a><a href="#como-funciona">Cómo funciona</a></nav><button className="cart" type="button">Bolsa <span>0</span></button></header><section className="landing" id="inicio"><div className="landing-copy"><p className="eyebrow">HECHAS PARA LLEVAR TU IDEA</p><h1>Tu idea.<br/><em>Tu remera.</em></h1><p className="landing-text">Diseñá una prenda que no se parece a ninguna otra. Elegí el color, subí tu arte y nosotros la hacemos realidad.</p><div className="landing-actions"><a className="primary-cta" href="#personaliza">Crear mi remera <span>↘</span></a><a className="text-cta" href="#como-funciona">Cómo funciona <span>↓</span></a></div><div className="home-note"><b>+500</b><span>prendas únicas<br/>impresas con cuidado</span></div></div><div className="hero-photo"><img src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=85" alt="Remeras personalizadas"/><div className="hero-stamp">DISEÑÁ<br/>SIN LÍMITES</div><p>EST. 2026 · BUENOS AIRES</p></div></section><section className="featured"><div className="featured-copy"><p className="eyebrow">HECHO A TU MANERA</p><h2>Una prenda que empieza<br/>con <em>vos.</em></h2><p>Para tu marca, tu banda, tu equipo o simplemente una idea que querés usar.</p></div><div className="photo-tile warm"><img src="https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80" alt="Estilo personal"/><span>EXPRESATE</span></div><div className="photo-tile dark"><img src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80" alt="Remera de algodón"/><span>100% ALGODÓN</span></div></section><section className="customizer-section" id="personaliza"><div className="customizer-intro"><p className="eyebrow">CREÁ TU PRENDA</p><h2>Personalizá tu remera.</h2><p>Subí tu diseño, acomodalo y mandanos tu pedido.</p></div><section className="customizer" aria-label="Personalizador de remera"><aside className="controls"><div className="step"><span>01</span><div><h2>Tu diseño</h2><p>PNG, JPG o WEBP · Máx. 10 MB</p></div></div><label className="upload" htmlFor="design-upload"><strong>{design ? 'Cambiar imagen' : 'Subir imagen'}</strong><small>{fileName || 'Elegí el archivo de tu dispositivo'}</small></label><input id="design-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadDesign}/>{design && <button className="remove-image" type="button" onClick={removeDesign}>× Quitar imagen</button>}{notice && <p className={`notice ${notice.startsWith('Atención') ? 'warning' : ''}`}>{notice}</p>}<div className="step separation"><span>02</span><div><h2>Personalizá</h2><p>Ajustá tu prenda</p></div></div><div className="option"><label>Color <b>{color.name}</b></label><div className="swatches">{COLORS.map(item => <button key={item.name} title={item.name} aria-label={item.name} className={color.name === item.name ? 'selected' : ''} onClick={() => setColor(item)} style={{ backgroundColor: item.value }}/>)}</div></div><div className="option"><label>Lado</label><div className="choice">{['Frente', 'Espalda'].map(item => <button key={item} onClick={() => setSide(item)} className={side === item ? 'active' : ''}>{item}</button>)}</div></div><div className="option"><label>Talle</label><div className="sizes">{SIZES.map(item => <button key={item} className={size === item ? 'active' : ''} onClick={() => setSize(item)}>{item}</button>)}</div></div></aside><section className="preview"><div className="preview-top"><span>VISTA {side.toUpperCase()}</span><span className="print-label">ÁREA MÁXIMA 30 × 40 CM</span></div><div className="canvas" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><Shirt color={color} design={design} transform={transform} side={side} onPointerDown={startDrag}/></div><p className="drag-help">{design ? 'Arrastrá el diseño para reposicionarlo' : 'Tu diseño aparecerá en esta zona'}</p></section><aside className="adjustments"><h2>Ajustes del diseño</h2><p className="adjust-copy">Usá los controles para dejarlo perfecto.</p><label className="range-label">Tamaño <output>{transform.scale}%</output></label><input className="range" type="range" min="20" max="90" value={transform.scale} onChange={event => setTransform({ ...transform, scale: event.target.value })}/><label className="range-label">Rotación <output>{transform.rotation}°</output></label><input className="range" type="range" min="-180" max="180" value={transform.rotation} onChange={event => setTransform({ ...transform, rotation: event.target.value })}/><button className="reset" onClick={() => setTransform({ x: 50, y: 43, scale: 54, rotation: 0 })}>↺ Restablecer posición</button><div className="summary"><span>Remera personalizada</span><strong>$ 18.900</strong><small>El precio final puede variar según el diseño.</small></div><a className="order" href={`https://wa.me/5491100000000?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Pedir por WhatsApp <span>→</span></a></aside></section></section><section className="how" id="como-funciona"><p className="eyebrow">ASÍ DE SIMPLE</p><h2>Diseñá, pedí, estrená.</h2><div><p><b>01</b> Subí tu imagen</p><p><b>02</b> Acomodala a tu gusto</p><p><b>03</b> Confirmá tu pedido</p></div></section></main>
}
export default App
