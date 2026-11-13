import { useEffect, useRef, useState } from 'react'
import { productOptions } from './productOptions'

const SHIRT_PRICE = 18900
const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || ''

function useDialogFocus(open, onClose) {
  const ref = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = setTimeout(() => ref.current?.querySelector('header button')?.focus(), 0)
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key !== 'Tab' || !ref.current) return
      const targets = [...ref.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"], iframe')].filter((node) => !node.disabled && node.getClientRects().length)
      const first = targets[0], last = targets[targets.length - 1]
      if (!first) { event.preventDefault(); ref.current.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', handleKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])
  return ref
}

let mercadoPagoSdk

function loadMercadoPagoSdk() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago)
  if (mercadoPagoSdk) return mercadoPagoSdk
  mercadoPagoSdk = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('No se pudo iniciar Mercado Pago.'))
    script.onerror = () => reject(new Error('No se pudo cargar Mercado Pago.'))
    document.head.append(script)
  })
  return mercadoPagoSdk
}

function cartSubtotal(items) {
  return items.reduce((sum, item) => sum + Number(item.price || SHIRT_PRICE) * item.quantity, 0)
}

function checkoutCart(items) {
  return items.map((item) => ({ productId: item.productId || '', kind: item.kind, quantity: item.quantity, color: item.color || '', size: item.size || '' }))
}

function readMoney(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function readCouponValidation(result) {
  if (!result || result.valid === false || !result.totals) return null

  const subtotal = readMoney(result.totals.subtotal)
  const discount = readMoney(result.totals.discount)
  const total = readMoney(result.totals.total)

  if (subtotal === null || discount === null || total === null) return null

  return {
    coupon: result.coupon && typeof result.coupon === 'object' ? result.coupon : {},
    totals: { subtotal, discount, total },
  }
}

function newCheckoutAttemptId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

function MercadoPagoCheckout({ items, customer, couponCode = '', couponTotals, onCancel, onComplete }) {
  const containerId = 'fenixis-card-payment'
  const subtotal = cartSubtotal(items)
  const hasVerifiedCoupon = Boolean(couponCode && couponTotals && readMoney(couponTotals.total) !== null)
  const total = hasVerifiedCoupon ? Number(couponTotals.total) : subtotal
  const [state, setState] = useState({ kind: 'loading', message: 'Estamos preparando el pago seguro…' })
  const checkoutAttempt = useRef(newCheckoutAttemptId())

  useEffect(() => {
    let mounted = true
    let controller

    if (!MERCADO_PAGO_PUBLIC_KEY) {
      setState({ kind: 'error', message: 'El checkout todavía no está configurado. Probá nuevamente en unos minutos.' })
      return undefined
    }

    const start = async () => {
      try {
        const MercadoPago = await loadMercadoPagoSdk()
        if (!mounted) return
        const mp = new MercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: 'es-AR' })
        const bricksBuilder = mp.bricks()
        controller = await bricksBuilder.create('cardPayment', containerId, {
          initialization: { amount: total, payer: { email: customer.email } },
          customization: { paymentMethods: { maxInstallments: 12 } },
          callbacks: {
            onReady: () => mounted && setState({ kind: 'ready', message: '' }),
            onSubmit: (formData, additionalData) => new Promise(async (resolve, reject) => {
              try {
                mounted && setState({ kind: 'processing', message: 'Procesando tu pago…' })
                const response = await fetch('/api/process-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cart: checkoutCart(items),
                    customer,
                    couponCode: couponCode || undefined,
                    checkoutAttemptId: checkoutAttempt.current,
                    payment: {
                      token: formData.token,
                      paymentMethodId: formData.payment_method_id,
                      paymentType: additionalData.paymentTypeId,
                      installments: formData.installments,
                      payer: formData.payer,
                    },
                  }),
                })
                const result = await response.json().catch(() => ({}))
                if (!response.ok) {
                  if (result.retryable === true) checkoutAttempt.current = newCheckoutAttemptId()
                  throw new Error(result.message || 'No pudimos procesar el pago. Revisá los datos e intentá nuevamente.')
                }
                if (mounted) {
                  const approved = result.status === 'approved' || (result.status === 'processed' && result.statusDetail === 'accredited')
                  setState({
                    kind: approved ? 'success' : 'pending',
                    message: approved ? '¡Pago aprobado! Recibimos tu compra.' : 'Tu pago quedó en revisión. Te vamos a avisar cuando se confirme.',
                    reference: result.reference || '',
                  })
                }
                resolve()
              } catch (error) {
                mounted && setState({ kind: 'error', message: error.message || 'No pudimos procesar el pago.' })
                reject(error)
              }
            }),
            onError: () => mounted && setState({ kind: 'error', message: 'Revisá los datos de la tarjeta e intentá nuevamente.' }),
          },
        })
      } catch (error) {
        mounted && setState({ kind: 'error', message: error.message || 'No pudimos iniciar Mercado Pago.' })
      }
    }

    start()
    return () => {
      mounted = false
      controller?.unmount?.()
    }
  }, [total, couponCode])

  if (state.kind === 'success' || state.kind === 'pending') return <section className={`payment-result ${state.kind}`}><span>{state.kind === 'success' ? '✓' : '◌'}</span><h3>{state.kind === 'success' ? 'Compra realizada' : 'Pago en revisión'}</h3><p>{state.message}</p><button type="button" onClick={onComplete}>Volver a la tienda</button></section>

  return <section className="mercado-pago-checkout"><div className="checkout-title"><div><p className="eyebrow">PAGO SEGURO</p><h3>Pagá con Mercado Pago</h3></div><button type="button" onClick={onCancel} aria-label="Volver a la bolsa">×</button></div><div className={`checkout-total ${hasVerifiedCoupon ? 'has-discount' : ''}`}>{hasVerifiedCoupon ? <><div><span>Subtotal</span><strong>$ {Number(couponTotals.subtotal).toLocaleString('es-AR')}</strong></div><div className="checkout-discount"><span>Descuento</span><strong>− $ {Number(couponTotals.discount).toLocaleString('es-AR')}</strong></div><div className="checkout-payable"><span>Total a pagar</span><strong>$ {total.toLocaleString('es-AR')}</strong></div></> : <div><span>Total a pagar</span><strong>$ {total.toLocaleString('es-AR')}</strong></div>}</div>{state.kind !== 'ready' && <p className={`payment-message ${state.kind}`}>{state.message}</p>}<div id={containerId}/><small>Los datos de tu tarjeta son procesados de forma segura por Mercado Pago.</small></section>
}

export function CartDrawer({ open, items, onClose, onRemove, onQuantity, onClear }) {
  const dialogRef = useDialogFocus(open, onClose)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', delivery: 'Retiro por el local', address: '', notes: '' })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutValidationError, setCheckoutValidationError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponState, setCouponState] = useState('idle')
  const [couponMessage, setCouponMessage] = useState('')
  const [couponResult, setCouponResult] = useState(null)
  const [couponCartFingerprint, setCouponCartFingerprint] = useState('')
  const subtotal = cartSubtotal(items)
  const cartFingerprint = items.map((item) => `${item.id}:${item.productId || ''}:${item.kind}:${item.size || ''}:${item.color || ''}:${item.quantity}`).join('|')
  const couponIsApplied = couponState === 'success' && couponCartFingerprint === cartFingerprint && Boolean(couponResult?.totals)
  const couponTotals = couponIsApplied ? couponResult.totals : null
  const total = couponTotals ? couponTotals.total : subtotal
  const appliedCouponCode = couponIsApplied ? String(couponResult?.coupon?.code || couponCode).trim().toUpperCase() : ''
  const updateCustomer = (key, value) => {
    setCustomer((current) => ({ ...current, [key]: value }))
    if (checkoutValidationError) setCheckoutValidationError('')
  }

  const beginCheckout = () => {
    const email = String(customer.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCheckoutValidationError('Ingresá un correo electrónico válido para enviarte la confirmación de compra.')
      return
    }
    const phoneDigits = String(customer.phone || '').replace(/\D/g, '')
    if (phoneDigits.length < 8 || phoneDigits.length > 16) {
      setCheckoutValidationError('Ingresá un número de teléfono válido para poder contactarte si hace falta.')
      return
    }
    if (customer.delivery === 'Envío a domicilio' && !String(customer.address || '').trim()) {
      setCheckoutValidationError('Ingresá la dirección para poder preparar el envío.')
      return
    }
    setCustomer((current) => ({ ...current, email }))
    setCheckoutOpen(true)
  }

  useEffect(() => {
    if (!couponCartFingerprint || couponCartFingerprint === cartFingerprint) return
    setCouponResult(null)
    setCouponCartFingerprint('')
    setCouponState('stale')
    setCouponMessage('Tu carrito cambió. Volvé a aplicar el código antes de pagar.')
  }, [cartFingerprint, couponCartFingerprint])

  const clearCoupon = () => {
    setCouponCode('')
    setCouponResult(null)
    setCouponCartFingerprint('')
    setCouponState('idle')
    setCouponMessage('')
  }

  const applyCoupon = async (event) => {
    event.preventDefault()
    const code = couponCode.trim().toUpperCase()
    if (!code) {
      setCouponState('error')
      setCouponMessage('Ingresá un código para poder verificarlo.')
      return
    }

    setCouponState('loading')
    setCouponMessage('')
    setCouponResult(null)

    try {
      const response = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: checkoutCart(items), couponCode: code }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.valid === false) throw new Error(result.message || 'No pudimos validar ese código. Probá nuevamente.')

      const validated = readCouponValidation(result)
      if (!validated) throw new Error(result.message || 'No pudimos verificar el descuento de ese código.')

      const acceptedCode = String(validated.coupon.code || code).trim().toUpperCase()
      setCouponCode(acceptedCode)
      setCouponResult(validated)
      setCouponCartFingerprint(cartFingerprint)
      setCouponState('success')
      setCouponMessage(result.message || `Código ${acceptedCode} aplicado.`)
    } catch (error) {
      setCouponState('error')
      setCouponMessage(error.message || 'No pudimos validar ese código. Probá nuevamente.')
    }
  }

  const updateCouponCode = (value) => {
    setCouponCode(value.toUpperCase())
    if (couponState !== 'idle' || couponResult) {
      setCouponResult(null)
      setCouponCartFingerprint('')
      setCouponState('idle')
      setCouponMessage('')
    }
  }

  const finish = () => {
    onClear()
    clearCoupon()
    setCheckoutOpen(false)
    onClose()
  }

  return <div className={`cart-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open ? true : undefined}>
    <button className="cart-backdrop" aria-label="Cerrar carrito" onClick={onClose}/>
    <aside ref={dialogRef} className="cart-drawer" role="dialog" aria-modal="true" aria-label="Tu carrito" tabIndex={-1}>
      <header><div><p className="eyebrow">TU COMPRA</p><h2>{checkoutOpen ? 'Pago' : 'Carrito'}</h2></div><button onClick={onClose} aria-label="Cerrar carrito">×</button></header>
      {items.length ? checkoutOpen ? <MercadoPagoCheckout items={items} customer={customer} couponCode={appliedCouponCode} couponTotals={couponTotals} onCancel={() => setCheckoutOpen(false)} onComplete={finish}/> : <>
        <div className="cart-items">{items.map((item) => {
          const price = Number(item.price || SHIRT_PRICE)
          const isCatalogProduct = item.kind === 'product'
          return <article className="cart-item" key={item.id}>
            <div className="cart-item-art">{isCatalogProduct && item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span style={{ background: item.colorValue || '#e6e4de' }}/>}</div>
            <div><h3>{item.title || 'Prenda'}</h3><p>{isCatalogProduct ? item.category || 'Producto del catálogo' : `${item.color} · Talle ${item.size}`}</p><small>{isCatalogProduct ? [[item.color && `Color: ${item.color}`, item.size && `Talle ${item.size}`].filter(Boolean).join(' · '), item.description || 'Producto de Fenixis'].filter(Boolean).join(' · ') : `${item.front ? `Frente: ${item.front}` : ''}${item.back ? ` · Espalda: ${item.back}` : ''}`}</small><div className="quantity"><button onClick={() => onQuantity(item.id, item.quantity - 1)} aria-label="Restar una unidad">−</button><b>{item.quantity}</b><button onClick={() => onQuantity(item.id, item.quantity + 1)} aria-label="Sumar una unidad">+</button><button className="remove-cart-item" onClick={() => onRemove(item.id)}>Quitar</button></div></div>
            <strong>$ {(price * item.quantity).toLocaleString('es-AR')}</strong>
          </article>
        })}</div>
        <footer className="cart-footer">
          <div className={`cart-totals ${couponIsApplied ? 'has-discount' : ''}`}>
            {couponIsApplied ? <><div><span>Subtotal</span><strong>$ {couponTotals.subtotal.toLocaleString('es-AR')}</strong></div><div className="cart-discount"><span>Descuento {appliedCouponCode}</span><strong>− $ {couponTotals.discount.toLocaleString('es-AR')}</strong></div><div className="cart-payable"><span>Total</span><strong>$ {total.toLocaleString('es-AR')}</strong></div></> : <div><span>Total</span><strong>$ {total.toLocaleString('es-AR')}</strong></div>}
          </div>
          <section className={`cart-coupon ${couponState}`} aria-label="Código de descuento">
            <div className="cart-coupon-heading"><label htmlFor="cart-coupon-code">Código promocional</label>{couponIsApplied && <button type="button" onClick={clearCoupon}>Quitar</button>}</div>
            <form className="cart-coupon-form" onSubmit={applyCoupon}>
              <input id="cart-coupon-code" value={couponCode} onChange={(event) => updateCouponCode(event.target.value)} placeholder="Ej. FENIXIS20" autoCapitalize="characters" autoComplete="off" disabled={couponState === 'loading'} />
              <button type="submit" disabled={!couponCode.trim() || couponState === 'loading'}>{couponState === 'loading' ? 'Verificando…' : couponIsApplied ? 'Actualizar' : 'Aplicar'}</button>
            </form>
            {couponMessage && <p className={`coupon-message ${couponState}`} role="status">{couponState === 'success' ? '✓ ' : ''}{couponMessage}</p>}
          </section>
          <div className="cart-customer"><label>Tu nombre<input value={customer.name} onChange={(event) => updateCustomer('name', event.target.value)} placeholder="Opcional" autoComplete="name" /></label><label>Correo electrónico<input value={customer.email} onChange={(event) => updateCustomer('email', event.target.value)} placeholder="nombre@email.com" type="email" autoComplete="email" required /></label><label>Teléfono<input value={customer.phone} onChange={(event) => updateCustomer('phone', event.target.value)} placeholder="Ej. 11 1234 5678" type="tel" inputMode="tel" autoComplete="tel" required /></label><label>Entrega<select value={customer.delivery} onChange={(event) => updateCustomer('delivery', event.target.value)}><option>Retiro por el local</option><option>Envío a domicilio</option></select></label>{customer.delivery === 'Envío a domicilio' && <label className="cart-wide">Dirección<input value={customer.address} onChange={(event) => updateCustomer('address', event.target.value)} placeholder="Calle, altura y localidad" autoComplete="street-address" required /></label>}<label className="cart-wide">Notas para el pedido<textarea value={customer.notes} onChange={(event) => updateCustomer('notes', event.target.value)} placeholder="Ej. Necesito recibirlo antes del viernes" rows="2" /></label></div>
          {checkoutValidationError && <p className="cart-customer-error" role="alert">{checkoutValidationError}</p>}
          <button className="checkout-button" type="button" onClick={beginCheckout}>Pagar con Mercado Pago <span>→</span></button>
          <p>Pago seguro procesado por Mercado Pago.</p>
        </footer>
      </> : <div className="empty-cart"><span>◌</span><h3>Tu carrito está vacía.</h3><p>Encontrá tu próxima favorita en nuestro catálogo.</p><button onClick={onClose}>Seguir viendo la tienda</button></div>}
    </aside>
  </div>
}

export function CatalogProductOptions({ product, onClose, onAdd }) {
  const dialogRef = useDialogFocus(Boolean(product), onClose)
  const { sizes, colors } = productOptions(product)
  const [size, setSize] = useState(() => sizes[0] || '')
  const [color, setColor] = useState(() => colors[0] || null)

  if (!product) return null

  const selectedSize = sizes.includes(size) ? size : sizes[0] || ''
  const selectedColor = colors.find((entry) => entry.name === color?.name) || colors[0] || null

  return <div className="catalog-options-layer" role="presentation">
    <button className="catalog-options-backdrop" type="button" aria-label="Cerrar opciones del producto" onClick={onClose} />
    <section ref={dialogRef} tabIndex={-1} className="catalog-options-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-options-title">
      <header><div><p className="eyebrow">ELEGÍ TU PRENDA</p><h2 id="catalog-options-title">{product.title}</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>
      {product.imageUrl && <img className="catalog-detail-photo" src={product.imageUrl} alt={product.title} />}
      {product.description && <p className="catalog-detail-description">{product.description}</p>}
      <p className="catalog-options-copy">{sizes.length || colors.length ? "Elegí tu talle y color entre las opciones disponibles." : "Esta prenda se vende tal como se muestra."}</p>
      {sizes.length > 0 && <fieldset><legend>Talle</legend><div className="catalog-option-buttons">{sizes.map((item) => <button type="button" key={item} className={selectedSize === item ? 'is-selected' : ''} aria-pressed={selectedSize === item} onClick={() => setSize(item)}>{item}</button>)}</div></fieldset>}
      {colors.length > 0 && <fieldset><legend>Color</legend><div className="catalog-color-buttons">{colors.map((item) => <button type="button" key={item.name} className={selectedColor?.name === item.name ? 'is-selected' : ''} aria-pressed={selectedColor?.name === item.name} onClick={() => setColor(item)}><i aria-hidden="true" style={{ backgroundColor: item.value }} />{item.name}</button>)}</div></fieldset>}
      <footer><strong>$ {Number(product.price || 0).toLocaleString('es-AR')}</strong><button className="catalog-options-add" type="button" onClick={() => onAdd({ size: selectedSize, color: selectedColor })}>Agregar al carrito <span>+</span></button></footer>
    </section>
  </div>
}
