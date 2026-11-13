import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { productOptions } from './productOptions'
import { DEFAULT_PRODUCT_TYPES, catalogProductTypes, productTypeIdFor, productTypeNameFor } from './productTypes'
import { CartDrawer, CatalogProductOptions } from './StoreCheckout'
import './ClothingStore.css'

const CART_KEY = 'tinta-club-cart'
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim()
const money = (value) => `$ ${Number(value || 0).toLocaleString('es-AR')}`

function readSavedCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(items)) return { items: [], removed: false }
    return { items: items.filter((item) => item?.kind === 'product' && item.productId && Number.isInteger(item.quantity) && item.quantity > 0), removed: items.some((item) => item?.kind === 'custom') }
  } catch { return { items: [], removed: false } }
}

export function Icon({ name, ...props }) {
  const paths = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M6 18 18 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>
}

function ProductCard({ product, types, onChoose }) {
  const { sizes, colors } = productOptions(product)
  return <article className="fashion-product">
    <button className="fashion-product-photo" onClick={() => onChoose(product)} aria-label={`Ver ${product.title}`}>
      {product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" width="448" height="560" /> : <span className="fashion-no-photo">FENIXIS<span>STORE</span></span>}
      <span className="fashion-photo-action">Ver prenda <Icon name="arrow" /></span>
    </button>
    <div className="fashion-product-info"><p>{productTypeNameFor(product, types)}{product.category ? ` / ${product.category}` : ''}</p>
      <h3><button onClick={() => onChoose(product)}>{product.title}</button></h3>
      {(sizes.length > 0 || colors.length > 0) && <div className="fashion-variants"><span>{sizes.join(' · ')}</span><span className="fashion-swatches">{colors.slice(0, 6).map((color) => <i key={color.name} style={{ background: color.value }} title={color.name} aria-label={color.name} />)}{colors.length > 6 && <small>+{colors.length - 6}</small>}</span></div>}
      <div className="fashion-product-bottom"><strong>{money(product.price)}</strong><button className="fashion-add" onClick={() => onChoose(product)} aria-label={`Agregar ${product.title} al carrito`}>Agregar <Icon name="plus" /></button></div>
    </div>
  </article>
}

export default function ClothingStore() {
  const path = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'
  const isCatalog = path === '/productos'
  const [savedCart] = useState(readSavedCart)
  const [cart, setCart] = useState(savedCart.items)
  const [notice, setNotice] = useState(savedCart.removed ? 'Los pedidos personalizados están pausados. Retiramos esas prendas de tu carrito; podés elegir las disponibles en la tienda.' : '')
  const [cartOpen, setCartOpen] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [types, setTypes] = useState(DEFAULT_PRODUCT_TYPES)
  const [offers, setOffers] = useState([])
  const [whatsapp, setWhatsapp] = useState('5491165937433')
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const [type, setType] = useState(() => new URLSearchParams(location.search).get('tipo') || 'all')
  const [category, setCategory] = useState('all')
  const [size, setSize] = useState('all')
  const [color, setColor] = useState('all')
  const [sort, setSort] = useState('featured')
  const [filtersOpen, setFiltersOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const menuButton = useRef(null)

  useEffect(() => {
    if (path === '/personaliza') window.location.replace('/productos/')
  }, [path])
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch { /* The cart also works for this visit when storage is unavailable. */ } }, [cart])
  useEffect(() => {
    let alive = true, seed = [], stored = [], seedDone = false, liveDone = false, seedFailed = false, liveFailed = false
    const update = () => {
      if (!alive || !seedDone || !liveDone) return
      const catalog = new Map(seed.filter((item) => !item.hidden).map((item) => [item.id, item]))
      stored.forEach((item) => { if (item.hidden) catalog.delete(item.id); else catalog.set(item.id, { ...catalog.get(item.id), ...item }) })
      setProducts([...catalog.values()]); setLoaded(true); setLoadError(seedFailed && liveFailed)
    }
    fetch('/products/catalog.json').then((response) => { if (!response.ok) throw new Error(); return response.json() }).then((data) => { seed = Array.isArray(data) ? data : [] }).catch(() => { seedFailed = true }).finally(() => { seedDone = true; update() })
    const stop = onSnapshot(collection(db, 'products'), (snapshot) => { stored = snapshot.docs.map((item) => ({ ...item.data(), id: item.id })); liveDone = true; update() }, () => { liveFailed = true; liveDone = true; update() })
    const stopTypes = onSnapshot(doc(db, 'settings', 'catalog'), (snapshot) => setTypes(catalogProductTypes(snapshot.data()?.productTypes)), () => {})
    const stopStore = onSnapshot(doc(db, 'settings', 'store'), (snapshot) => { const number = String(snapshot.data()?.whatsappNumber || '').replace(/\D/g, ''); if (number) setWhatsapp(number) }, () => {})
    return () => { alive = false; stop(); stopTypes(); stopStore() }
  }, [])
  useEffect(() => {
    if (isCatalog) return
    return onSnapshot(collection(db, 'offers'), (snapshot) => {
      setOffers(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).filter((offer) => offer.active !== false).sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)))
    }, () => {})
  }, [isCatalog])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  useEffect(() => {
    if (!chosen || !loaded) return
    const current = products.find((product) => product.id === chosen.id)
    if (!current) { setChosen(null); setNotice('Esta prenda ya no está disponible. Elegí otra del catálogo.') }
    else if (current !== chosen) setChosen(current)
  }, [products, loaded, chosen])

  const addProduct = (selection) => {
    if (!chosen || !products.some((product) => product.id === chosen.id)) return
    const id = `product:${chosen.id}:${selection.size || ''}:${selection.color?.name || ''}`
    const item = { id, productId: chosen.id, kind: 'product', title: chosen.title, price: Number(chosen.price), imageUrl: chosen.imageUrl || '', category: chosen.category || '', description: chosen.description || '', size: selection.size || '', color: selection.color?.name || '', colorValue: selection.color?.value || '', quantity: 1 }
    setCart((current) => current.some((entry) => entry.id === id) ? current.map((entry) => entry.id === id ? { ...entry, quantity: Math.min(10, entry.quantity + 1) } : entry) : [...current, item])
    setChosen(null); setCartOpen(true)
  }
  const clearFilters = () => { setQuery(''); setType('all'); setCategory('all'); setSize('all'); setColor('all') }
  const activeType = types.some((entry) => entry.id === type) ? type : 'all'
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort()
  const availableSizes = [...new Set(products.flatMap((product) => productOptions(product).sizes))]
  const availableColors = [...new Set(products.flatMap((product) => productOptions(product).colors.map((entry) => entry.name)))].sort()
  const filtered = products.filter((product) => {
    const options = productOptions(product)
    return (activeType === 'all' || productTypeIdFor(product) === activeType)
      && (category === 'all' || category === product.category)
      && (size === 'all' || options.sizes.includes(size))
      && (color === 'all' || options.colors.some((entry) => entry.name === color))
      && normalize([product.title, product.id, product.description, product.category, productTypeNameFor(product, types)].join(' ')).includes(normalize(query))
  }).sort((a, b) => sort === 'price-up' ? Number(a.price) - Number(b.price) : sort === 'price-down' ? Number(b.price) - Number(a.price) : sort === 'name' ? a.title.localeCompare(b.title, 'es-AR') : 0)
  const filtersActive = query || activeType !== 'all' || category !== 'all' || size !== 'all' || color !== 'all'
  const featured = products.slice(0, 4)
  const heroMain = products.find((product) => product.id === 'remeron-la-dolce-vita' && product.imageUrl) || products.find((product) => product.imageUrl)
  const heroSecond = products.find((product) => product.id === 'remeron-golden-girasoles' && product.imageUrl && product.id !== heroMain?.id) || products.find((product) => product.imageUrl && product.id !== heroMain?.id)
  const whatsappUrl = `https://wa.me/${whatsapp}`
  const renderGrid = (items) => <div className="fashion-grid">{items.map((product) => <ProductCard key={product.id} product={product} types={types} onChoose={setChosen} />)}</div>
  const loading = <div className="fashion-loading" role="status">Cargando prendas…</div>

  return <div className="fashion-shell">
    <div className="fashion-store" inert={cartOpen || Boolean(chosen) ? true : undefined}>
      <a className="fashion-skip" href="#contenido">Ir al contenido</a>
      <div className="fashion-announcement">Prendas para todos tus días. Encontrá las tuyas.</div>
      <header className="fashion-header">
        <a className="fashion-logo" href="/" aria-label="Fenixis Store, inicio"><span className="brand-wordmark" /></a>
        <nav className={menuOpen ? 'fashion-nav is-open' : 'fashion-nav'} id="store-navigation" aria-label="Navegación principal">
          <a href="/" aria-current={!isCatalog ? 'page' : undefined}>Inicio</a><a href="/productos/" aria-current={isCatalog ? 'page' : undefined}>Todas las prendas</a><a href="/#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
        </nav>
        <div className="fashion-header-actions"><a href="/productos/#buscar" className="fashion-icon-button fashion-header-search" aria-label="Buscar prendas"><Icon name="search" /></a><button className="fashion-bag" onClick={() => { setMenuOpen(false); setCartOpen(true) }} aria-label={`Abrir carrito, ${cart.reduce((sum, item) => sum + item.quantity, 0)} prendas`}><Icon name="bag" /><span className="fashion-bag-label">Mi carrito</span><span className="fashion-bag-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></button><button ref={menuButton} className="fashion-icon-button fashion-menu" aria-expanded={menuOpen} aria-controls="store-navigation" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button></div>
      </header>
      {notice && <div className="fashion-notice" role="status"><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Cerrar aviso"><Icon name="close" /></button></div>}
      <main className="fashion-main" id="contenido">
        {!isCatalog ? <>
          <section className="fashion-hero">
            <div className="fashion-hero-copy"><h1>Vestite como<br /><em>te gusta.</em></h1><p>Prendas con personalidad, para combinar a tu manera y acompañarte todos los días.</p><a className="fashion-button" href="/productos/">Explorar la tienda <Icon name="arrow" /></a><a className="fashion-subtle-link" href="#favoritas">Encontrá tu próxima favorita</a></div>
            <div className="fashion-hero-gallery">
              {heroMain ? <button className="fashion-hero-main" onClick={() => setChosen(heroMain)} aria-label={`Ver ${heroMain.title}`}><img src={heroMain.imageUrl} alt={heroMain.title} width="560" height="700" fetchPriority="high" /><span>{heroMain.title}<Icon name="arrow" /></span></button> : <div className="fashion-hero-placeholder">FENIXIS<br />STORE</div>}
              {heroSecond && <button className="fashion-hero-secondary" onClick={() => setChosen(heroSecond)} aria-label={`Ver ${heroSecond.title}`}><img src={heroSecond.imageUrl} alt={heroSecond.title} width="448" height="560" /><span>Tu estilo, tus reglas.</span></button>}
            </div>
          </section>
          <section className="fashion-type-section" aria-label="Comprar por tipo de prenda"><span>¿Qué tenés ganas de estrenar?</span><div>{types.map((entry) => <a key={entry.id} href={`/productos/?tipo=${encodeURIComponent(entry.id)}`}>{entry.name}<Icon name="arrow" /></a>)}</div></section>
          {offers.length > 0 && <section className="fashion-offers" aria-label="Ofertas disponibles">{offers.map((offer) => <article key={offer.id}><div><h2>{offer.title || 'Una oportunidad para estrenar'}</h2><p>{offer.description}</p></div><div>{offer.code && <span className="fashion-offer-code">Usá el código <strong>{offer.code}</strong></span>}<a href="/productos/" className="fashion-button">Ver prendas <Icon name="arrow" /></a></div></article>)}</section>}
          <section className="fashion-featured" id="favoritas"><div className="fashion-section-heading"><div><h2>Un flechazo.<br /><em>Tu próxima favorita.</em></h2><p>Explorá las prendas de nuestra tienda y elegí la que va con vos.</p></div><a className="fashion-text-link" href="/productos/">Ver todas las prendas <Icon name="arrow" /></a></div>{!loaded ? loading : featured.length ? renderGrid(featured) : <p className="fashion-empty">{loadError ? 'No pudimos cargar las prendas. Volvé a intentar en unos minutos.' : 'Estamos preparando novedades. Volvé pronto para descubrirlas.'}</p>}</section>
          <section className="fashion-help"><div><h2>Elegí. Combiná.<br /><em>Hacelo tuyo.</em></h2><p>Un color que te encanta. Una prenda que te representa. Encontrá ese detalle que hace tu look.</p><a href="/productos/" className="fashion-text-link">Encontrar mi prenda <Icon name="arrow" /></a></div><div className="fashion-shopping-notes"><div><span>Elegí tu talle</span><p>Cada prenda muestra sus talles y colores disponibles.</p></div><div><span>Pagá con Mercado Pago</span><p>Completá tu compra de forma segura desde el carrito.</p></div><div><span>Retiro o envío</span><p>Elegí cómo recibir tu pedido al realizar la compra. Si tenés dudas, escribinos.</p></div></div></section>
        </> : <>
          <section className="fashion-catalog-intro"><h1>Elegí tu<br /><em>próxima prenda.</em></h1><p>Buscá ese color, ese estilo, eso que va con vos.</p></section>
          <section className="fashion-catalog" aria-label="Catálogo de prendas"><div className="fashion-catalog-toolbar" id="buscar"><label className="fashion-search"><span>Buscar prendas</span><div><Icon name="search" /><input type="search" placeholder="Nombre, código o estilo…" value={query} onChange={(event) => setQuery(event.target.value)} /></div></label><label className="fashion-sort">Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Selección de la tienda</option><option value="price-up">Menor precio</option><option value="price-down">Mayor precio</option><option value="name">Nombre: A a Z</option></select></label></div>
            <div className="fashion-catalog-layout"><aside className="fashion-filters" aria-label="Filtros de prendas"><details open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}><summary>Filtrar prendas</summary><div className="fashion-filter-body"><h2>Tipo de prenda</h2><div className="fashion-type-filters">{[{ id: 'all', name: 'Todas las prendas' }, ...types].map((entry) => <button key={entry.id} aria-pressed={entry.id === activeType} onClick={() => setType(entry.id)}><span>{entry.name}</span><small>{entry.id === 'all' ? products.length : products.filter((product) => productTypeIdFor(product) === entry.id).length}</small></button>)}</div>{categories.length > 1 && <label>Colección<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas las colecciones</option>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></label>}{availableSizes.length > 0 && <label>Talle<select value={size} onChange={(event) => setSize(event.target.value)}><option value="all">Todos los talles</option>{availableSizes.map((entry) => <option key={entry}>{entry}</option>)}</select></label>}{availableColors.length > 0 && <label>Color<select value={color} onChange={(event) => setColor(event.target.value)}><option value="all">Todos los colores</option>{availableColors.map((entry) => <option key={entry}>{entry}</option>)}</select></label>}</div></details></aside>
              <div className="fashion-results"><div className="fashion-result-count"><p role="status">{loaded ? `${filtered.length} ${filtered.length === 1 ? 'prenda' : 'prendas'}` : 'Cargando catálogo…'}</p>{filtersActive && <button onClick={clearFilters}>Limpiar filtros</button>}</div>{!loaded ? loading : filtered.length ? renderGrid(filtered) : <div className="fashion-empty"><h2>{loadError ? 'No pudimos cargar el catálogo.' : 'No encontramos prendas con esa búsqueda.'}</h2><p>{loadError ? 'Volvé a cargar la página para intentarlo de nuevo.' : 'Probá con otro nombre o explorá las otras categorías.'}</p><button className="fashion-button" onClick={loadError ? () => location.reload() : clearFilters}>{loadError ? 'Volver a cargar' : 'Ver todas las prendas'}</button></div>}</div></div>
          </section>
        </>}
      </main>
      <footer className="fashion-footer" id="contacto"><div className="fashion-footer-top"><div><a href="/" aria-label="Fenixis Store, inicio"><span className="brand-wordmark" /></a><p>Para todos tus días.<br />Para ser vos.</p></div><div><h2>La tienda</h2><a href="/">Inicio</a><a href="/productos/">Todas las prendas</a><button onClick={() => setCartOpen(true)}>Mi carrito</button></div><div><h2>Estamos para ayudarte</h2><a href={whatsappUrl} target="_blank" rel="noreferrer">Escribinos por WhatsApp <Icon name="arrow" /></a><a href="mailto:fenixisstore@gmail.com">fenixisstore@gmail.com</a><span>Buenos Aires, Argentina</span></div><div><h2>Seguí a Fenixis</h2><a href="https://www.instagram.com/fenixisstore/" target="_blank" rel="noreferrer">Instagram <Icon name="arrow" /></a><a href="https://www.tiktok.com/@fenixisstore" target="_blank" rel="noreferrer">TikTok <Icon name="arrow" /></a></div></div><div className="fashion-footer-bottom"><span>© {new Date().getFullYear()} Fenixis Store</span><span>Pagos seguros con Mercado Pago</span></div></footer>
    </div>
    <CartDrawer open={cartOpen} items={cart} onClose={() => setCartOpen(false)} onRemove={(id) => setCart((items) => items.filter((item) => item.id !== id))} onQuantity={(id, quantity) => setCart((items) => quantity <= 0 ? items.filter((item) => item.id !== id) : items.map((item) => item.id === id ? { ...item, quantity: Math.min(10, quantity) } : item))} onClear={() => setCart([])} />
    {chosen && <CatalogProductOptions key={chosen.id} product={chosen} onClose={() => setChosen(null)} onAdd={addProduct} />}
  </div>
}
