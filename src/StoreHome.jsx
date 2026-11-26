import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue, useReducedMotion } from 'motion/react'
import { hasProductStock } from './productInventory'
import { productTypeIdFor } from './productTypes'
import { normalizePaymentSettings, productPricing, transferAvailable } from './paymentSettings'
import { normalizeDeliverySettings } from './deliverySettings'
import { PlaybackIcon } from './PlaybackIcon'
import { usePageVisible } from './usePageVisible'
import './StoreHome.css'

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const timestamp = (value) => value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : 0)

export function HomeAnnouncement({ paymentSettings, suspended = false }) {
  const payments = normalizePaymentSettings(paymentSettings)
  const transfer = transferAvailable(payments) && payments.transferDiscountPercent > 0
  const promotion = transfer ? `${payments.transferDiscountPercent}% OFF con transferencia` : 'Encontrá tu próxima prenda favorita'
  const viewport = useRef(null)
  const segment = useRef(null)
  const animation = useRef(null)
  const x = useMotionValue(0)
  const reducedMotion = useReducedMotion()
  const inView = useInView(viewport)
  const pageVisible = usePageVisible()
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [geometry, setGeometry] = useState({ copies: 2, distance: 0 })
  const playing = !reducedMotion && !paused && !hovered && !suspended && inView && pageVisible

  useEffect(() => {
    const measure = () => {
      const width = segment.current?.getBoundingClientRect().width || 0
      if (!width) return
      const copies = Math.max(2, Math.ceil(viewport.current.clientWidth / width) + 1)
      const distance = copies * width
      setGeometry((current) => current.copies === copies && current.distance === distance ? current : { copies, distance })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport.current)
    observer.observe(segment.current)
    measure()
    return () => observer.disconnect()
  }, [promotion, reducedMotion])

  useEffect(() => {
    x.set(0)
    if (reducedMotion || !geometry.distance) return
    const controls = animate(x, [0, -geometry.distance], { duration: geometry.distance / 32, ease: 'linear', repeat: Infinity })
    controls.pause()
    animation.current = controls
    return () => { controls.stop(); animation.current = null }
  }, [geometry.distance, reducedMotion, x])

  useEffect(() => {
    if (playing) animation.current?.play()
    else animation.current?.pause()
  }, [playing, geometry.distance, reducedMotion])

  return <div className={`fashion-announcement home-announcement${reducedMotion ? ' is-static' : ''}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)}>
    <span className="store-motion-sr">{promotion}. Envíos y retiro por el local.</span>
    <div className="home-announcement-viewport" ref={viewport}>
      <motion.div className="home-announcement-track" style={{ x }} aria-hidden="true">
        {Array.from({ length: reducedMotion ? 1 : 2 }, (_, group) => <div className="home-announcement-group" key={group}>
          {Array.from({ length: reducedMotion ? 1 : geometry.copies }, (_, copy) => <div className="home-announcement-set" ref={group === 0 && copy === 0 ? segment : undefined} key={copy}>
            <span>{transfer ? <><strong>{payments.transferDiscountPercent}% OFF</strong> con transferencia</> : promotion}</span><span>Envíos y retiro por el local</span>
          </div>)}
        </div>)}
      </motion.div>
    </div>
    {!reducedMotion && <button type="button" className="home-announcement-toggle" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar avisos' : 'Pausar avisos'} title={paused ? 'Reanudar avisos' : 'Pausar avisos'}><PlaybackIcon paused={paused} /></button>}
  </div>
}

export default function StoreHome({ products, types, offers, loaded, loadError, paymentSettings, deliverySettings, whatsappUrl, onChoose, renderCarousel, Icon }) {
  const payments = normalizePaymentSettings(paymentSettings)
  const delivery = normalizeDeliverySettings(deliverySettings)
  const transfer = transferAvailable(payments)
  const photographed = products.filter((product) => product.imageUrl && hasProductStock(product))
  const heroMain = photographed.find((product) => normalize(product.title) === 'vestido siena') || photographed.find((product) => /vestido/.test(normalize(product.title))) || photographed[0]
  const heroSecond = photographed.find((product) => normalize(product.title) === 'remera roma' && product.id !== heroMain?.id) || photographed.find((product) => product.id !== heroMain?.id)
  const selection = [...products].sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) || timestamp(b.createdAt) - timestamp(a.createdAt))
  const discounted = selection.filter((product) => productPricing(product).discountPercent > 0)
  const categoryPhotos = types.map((type) => ({ ...type, product: photographed.find((product) => productTypeIdFor(product) === type.id) })).filter((type) => type.product).slice(0, 4)
  const renderProducts = (items, id, label) => !loaded ? <div className="home-products-loading" role="status">Cargando prendas…</div> : items.length ? renderCarousel(items, id, label) : <div className="fashion-empty"><p>{loadError ? 'No pudimos cargar las prendas. Volvé a intentar.' : 'Estamos preparando novedades para vos.'}</p>{loadError && <button className="fashion-button" onClick={() => window.location.reload()}>Volver a cargar</button>}</div>

  return <>
    <section className="home-campaign" aria-labelledby="home-title">
      <div className={`home-campaign-photos${heroMain && !heroSecond ? ' is-single' : ''}`}>
        {[heroMain, heroSecond].filter(Boolean).map((product, index) => <button key={product.id} className="home-campaign-photo" onClick={() => onChoose(product)} aria-label={`Ver ${product.title}`}>
          <img src={product.imageUrl} alt={product.title} width="720" height="800" fetchPriority={index === 0 ? 'high' : 'auto'} />
          <span>{product.title}<Icon name="arrow" /></span>
        </button>)}
        {!heroMain && <div className="home-campaign-placeholder" aria-hidden="true"><span className="brand-wordmark" /></div>}
      </div>
      <div className="home-campaign-copy"><h1 id="home-title">Vestite como te gusta.</h1><a href="/productos/" className="fashion-button">Descubrir la colección <Icon name="arrow" /></a></div>
    </section>

    <nav className="home-categories" aria-label="Comprar por tipo de prenda"><a href="/productos/">Todas las prendas</a>{types.map((type) => <a key={type.id} href={`/productos/?tipo=${encodeURIComponent(type.id)}`}>{type.name}</a>)}</nav>

    <section className="home-product-section" id="favoritas" aria-labelledby="collection-title">
      <div className="home-section-title"><h2 id="collection-title">Descubrí la colección</h2><p>Prendas para todos tus días. Elegí las que van con vos.</p></div>
      {renderProducts(selection, 'home-product-carousel', 'Prendas de la colección')}
      {products.length > 0 && <a className="home-all-link" href="/productos/">Ver todas las prendas <Icon name="arrow" /></a>}
    </section>

    {categoryPhotos.length > 1 && <section className="home-category-section" aria-labelledby="category-title">
      <div className="home-section-title"><h2 id="category-title">Encontrá tu estilo</h2></div>
      <div className="home-category-grid">{categoryPhotos.map((type) => <a key={type.id} href={`/productos/?tipo=${encodeURIComponent(type.id)}`} className="home-category-card">
        <img src={type.product.imageUrl} alt="" loading="lazy" width="480" height="600" /><span>{type.name}<Icon name="arrow" /></span>
      </a>)}</div>
    </section>}

    {discounted.length > 0 && <section className="home-product-section home-sale" aria-labelledby="sale-title">
      <div className="home-section-title"><h2 id="sale-title">Prendas en oferta</h2><p>Encontrá tu favorita a un precio especial.</p></div>
      {renderProducts(discounted, 'home-sale-carousel', 'Prendas en oferta')}
    </section>}

    {offers.length > 0 && <section className="fashion-offers home-offers" aria-label="Promociones de la tienda">{offers.map((offer) => <article key={offer.id}><div><h2>{offer.title || 'Una oportunidad para estrenar'}</h2>{offer.description && <p>{offer.description}</p>}</div><div>{offer.code && <span className="fashion-offer-code">Usá el código <strong>{offer.code}</strong></span>}<a href="/productos/" className="fashion-button">Ver prendas <Icon name="arrow" /></a></div></article>)}</section>}

    <section className="home-shopping-info" aria-label="Cómo comprar en Fenixis">
      <div><Icon name="bag" /><h2>Elegí cómo pagar</h2><p>{transfer && payments.transferDiscountPercent > 0 ? `${payments.transferDiscountPercent}% de descuento por transferencia sobre tus prendas. También podés pagar con Mercado Pago.` : transfer ? 'Pagá con Mercado Pago o por transferencia bancaria.' : 'Pagá de forma segura con Mercado Pago.'}</p></div>
      <div><Icon name="delivery" /><h2>Envíos y retiros</h2><p>Recibí tu pedido en domicilio o sucursal de Correo Argentino. También podés retirarlo en {delivery.pickupAddress}.</p></div>
      <div><Icon name="chat" /><h2>Te ayudamos a elegir</h2><p>Consultanos por talles, colores o cualquier detalle de tu próxima prenda.</p><a href={whatsappUrl} target="_blank" rel="noreferrer">Escribinos por WhatsApp <Icon name="arrow" /></a></div>
    </section>
    <a className="home-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Consultar a Fenixis por WhatsApp"><Icon name="chat" /></a>
  </>
}
