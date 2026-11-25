import { useEffect, useRef, useState } from 'react'
import { productOptions, productImages } from './productOptions'
import { availableStock } from './productInventory'
import { DELIVERY_OPTIONS, deliveryDetails } from './deliverySettings.js'
import './ProductDetails.css'
import './DeliveryCheckout.css'
import { normalizePaymentSettings, transferAvailable, transferDiscount } from './paymentSettings.js'
import ProductPrice from './ProductPrice'
import TransferCheckout, { TransferReceipt } from './TransferCheckout'

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

function OrderTotals({ subtotal, discount = 0, transferSaving = 0, shipping = 0, total, couponCode = '', pickup = false }) {
  return <div className="delivery-order-totals" aria-live="polite">
    <div><span>Prendas</span><strong>$ {subtotal.toLocaleString('es-AR')}</strong></div>
    {discount > 0 && <div><span>Descuento {couponCode}</span><strong>− $ {discount.toLocaleString('es-AR')}</strong></div>}
    {transferSaving > 0 && <div><span>Descuento por transferencia</span><strong>− $ {transferSaving.toLocaleString('es-AR')}</strong></div>}
    <div><span>{pickup ? 'Retiro por el local' : 'Envío'}</span><strong>{shipping ? `$ ${shipping.toLocaleString('es-AR')}` : 'Sin cargo'}</strong></div>
    <div className="delivery-order-total"><span>Total a pagar</span><strong>$ {total.toLocaleString('es-AR')}</strong></div>
  </div>
}

function DeliverySummary({ delivery }) {
  return <div className="checkout-delivery-summary">
    <strong>{delivery.label}</strong>
    {delivery.mode === 'pickup' ? <><p>{delivery.pickupAddress}</p>{delivery.pickupHours && <p>{delivery.pickupHours}</p>}</> : <p>{delivery.instructions}</p>}
  </div>
}

function MercadoPagoCheckout({ items, customer, delivery, couponCode = '', couponTotals, onCancel, onComplete }) {
  const containerId = 'fenixis-card-payment'
  const subtotal = cartSubtotal(items)
  const hasVerifiedCoupon = Boolean(couponCode && couponTotals && readMoney(couponTotals.total) !== null)
  const total = (hasVerifiedCoupon ? Number(couponTotals.total) : subtotal) + delivery.cost
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
                    deliveryQuote: delivery,
                    expectedTotal: total,
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

  if (state.kind === 'success' || state.kind === 'pending') return <section className={`payment-result ${state.kind}`}><span>{state.kind === 'success' ? '✓' : '◌'}</span><h3>{state.kind === 'success' ? 'Compra realizada' : 'Pago en revisión'}</h3><p>{state.message}</p><DeliverySummary delivery={delivery} /><button type="button" onClick={onComplete}>Volver a la tienda</button></section>

  return <section className="mercado-pago-checkout"><div className="checkout-title"><div><h3>Pagá con Mercado Pago</h3></div><button type="button" onClick={onCancel} aria-label="Volver al carrito">×</button></div><DeliverySummary delivery={delivery} /><OrderTotals subtotal={hasVerifiedCoupon ? Number(couponTotals.subtotal) : subtotal} discount={hasVerifiedCoupon ? Number(couponTotals.discount) : 0} shipping={delivery.cost} pickup={delivery.mode === 'pickup'} total={total} couponCode={couponCode} />{state.kind !== 'ready' && <p className={`payment-message ${state.kind}`}>{state.message}</p>}<div id={containerId}/><small>Los datos de tu tarjeta son procesados de forma segura por Mercado Pago.</small></section>
}

export function CartDrawer({ open, items, onClose, onRemove, onQuantity, onClear, stockLimits = {}, deliverySettings, paymentSettings, deliveryState = 'ready' }) {
  const dialogRef = useDialogFocus(open, onClose)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', delivery: 'Retiro por el local', address: '', notes: '' })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSnapshot, setCheckoutSnapshot] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('mercadopago')
  const [transferReceipt, setTransferReceipt] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('fenixis-transfer-receipt') || 'null'); return saved?.reference && saved?.transferDetails && saved?.deliveryDetails && Array.isArray(saved.items) ? saved : null } catch { return null }
  })
  const payments = normalizePaymentSettings(paymentSettings)
  const transferEnabled = transferAvailable(payments)
  const selectedPayment = transferEnabled && paymentMethod === 'transfer' ? 'transfer' : 'mercadopago'
  const [checkoutValidationError, setCheckoutValidationError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponState, setCouponState] = useState('idle')
  const [couponMessage, setCouponMessage] = useState('')
  const [couponResult, setCouponResult] = useState(null)
  const [couponCartFingerprint, setCouponCartFingerprint] = useState('')
  const subtotal = cartSubtotal(items)
  const cartFingerprint = items.map((item) => `${item.id}:${item.productId || ''}:${item.kind}:${item.size || ''}:${item.color || ''}:${item.quantity}:${item.price}`).join('|')
  const couponIsApplied = couponState === 'success' && couponCartFingerprint === cartFingerprint && Boolean(couponResult?.totals)
  const couponTotals = couponIsApplied ? couponResult.totals : null
  const delivery = deliveryDetails(customer.delivery, deliverySettings)
  const paymentConflict = selectedPayment === 'transfer' && couponIsApplied && payments.transferDiscountPercent > 0
  const transferSaving = selectedPayment === 'transfer' && !paymentConflict ? transferDiscount(couponTotals ? couponTotals.total : subtotal, payments) : 0
  const total = (couponTotals ? couponTotals.total : subtotal) - transferSaving + delivery.cost
  const appliedCouponCode = couponIsApplied ? String(couponResult?.coupon?.code || couponCode).trim().toUpperCase() : ''
  const updateCustomer = (key, value) => {
    setCustomer((current) => ({ ...current, [key]: value }))
    if (checkoutValidationError) setCheckoutValidationError('')
  }

  const beginCheckout = () => {
    if (deliveryState !== 'ready') { setCheckoutValidationError('Esperá a que se carguen las opciones de entrega antes de pagar.'); return }
    if (items.some((item) => item.quantity > (stockLimits[item.id] ?? 10))) { setCheckoutValidationError('Cambió la disponibilidad de una prenda. Ajustá las cantidades o quitá las que estén sin stock para continuar.'); return }
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
    setCustomer((current) => ({ ...current, email }))
    if (selectedPayment === 'transfer' && couponIsApplied && payments.transferDiscountPercent > 0) { setCheckoutValidationError('El descuento por transferencia no se acumula con cupones. Quitá el código o elegí Mercado Pago.'); return }
    setCheckoutSnapshot({ items: structuredClone(items), customer: { ...customer, email }, delivery, couponCode: appliedCouponCode, couponTotals, paymentSettings: payments, method: selectedPayment })
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
    setTransferReceipt(null)
    try { sessionStorage.removeItem('fenixis-transfer-receipt') } catch { /* optional session storage */ }
    clearCoupon()
    setCheckoutOpen(false)
    onClose()
  }

  const receivedTransfer = (order) => {
    setTransferReceipt(order)
    try { sessionStorage.setItem('fenixis-transfer-receipt', JSON.stringify(order)) } catch { /* receipt remains visible for this visit */ }
    onClear()
  }

  return <div className={`cart-layer ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open ? true : undefined}>
    <button className="cart-backdrop" aria-label="Cerrar carrito" onClick={onClose}/>
    <aside ref={dialogRef} className="cart-drawer" role="dialog" aria-modal="true" aria-label="Tu carrito" tabIndex={-1}>
      <header><div><p className="eyebrow">TU COMPRA</p><h2>{transferReceipt ? 'Pedido' : checkoutOpen ? 'Pago' : 'Carrito'}</h2></div><button onClick={onClose} aria-label="Cerrar carrito">×</button></header>
      {transferReceipt ? <TransferReceipt order={transferReceipt} onComplete={finish} /> : checkoutOpen ? checkoutSnapshot.method === 'transfer' ? <TransferCheckout {...checkoutSnapshot} onCancel={() => setCheckoutOpen(false)} onCreated={receivedTransfer} /> : <MercadoPagoCheckout {...checkoutSnapshot} onCancel={() => setCheckoutOpen(false)} onComplete={finish}/> : items.length ? <>
        <div className="cart-items">{items.map((item) => {
          const price = Number(item.price || SHIRT_PRICE)
          const isCatalogProduct = item.kind === 'product'
          return <article className="cart-item" key={item.id}>
            <div className="cart-item-art">{isCatalogProduct && item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span style={{ background: item.colorValue || '#e6e4de' }}/>}</div>
            <div><h3>{item.title || 'Prenda'}</h3><p>{isCatalogProduct ? item.category || 'Producto del catálogo' : `${item.color} · Talle ${item.size}`}</p><small>{isCatalogProduct ? [[item.color && `Color: ${item.color}`, item.size && `Talle ${item.size}`].filter(Boolean).join(' · '), item.description || 'Producto de Fenixis'].filter(Boolean).join(' · ') : `${item.front ? `Frente: ${item.front}` : ''}${item.back ? ` · Espalda: ${item.back}` : ''}`}</small><div className="quantity"><button onClick={() => onQuantity(item.id, item.quantity - 1)} aria-label="Restar una unidad">−</button><b>{item.quantity}</b><button disabled={item.quantity >= (stockLimits[item.id] ?? 10)} onClick={() => onQuantity(item.id, item.quantity + 1)} aria-label="Sumar una unidad">+</button><button className="remove-cart-item" onClick={() => onRemove(item.id)}>Quitar</button></div></div>
            <strong>{item.quantity > (stockLimits[item.id] ?? 10) && <small className="cart-stock-error">{stockLimits[item.id] === 0 ? 'Sin stock' : `Disponibles: ${stockLimits[item.id]}`}</small>}$ {(price * item.quantity).toLocaleString('es-AR')}</strong>
          </article>
        })}</div>
        <footer className="cart-footer">
          <section className={`cart-coupon ${couponState}`} aria-label="Código de descuento">
            <div className="cart-coupon-heading"><label htmlFor="cart-coupon-code">Código promocional</label>{couponIsApplied && <button type="button" onClick={clearCoupon}>Quitar</button>}</div>
            <form className="cart-coupon-form" onSubmit={applyCoupon}>
              <input id="cart-coupon-code" value={couponCode} onChange={(event) => updateCouponCode(event.target.value)} placeholder="Ej. FENIXIS20" autoCapitalize="characters" autoComplete="off" disabled={couponState === 'loading'} />
              <button type="submit" disabled={!couponCode.trim() || couponState === 'loading'}>{couponState === 'loading' ? 'Verificando…' : couponIsApplied ? 'Actualizar' : 'Aplicar'}</button>
            </form>
            {couponMessage && <p className={`coupon-message ${couponState}`} role="status">{couponState === 'success' ? '✓ ' : ''}{couponMessage}</p>}
          </section>
          <div className="cart-customer"><label>Tu nombre<input value={customer.name} onChange={(event) => updateCustomer('name', event.target.value)} placeholder="Opcional" autoComplete="name" /></label><label>Correo electrónico<input value={customer.email} onChange={(event) => updateCustomer('email', event.target.value)} placeholder="nombre@email.com" type="email" autoComplete="email" required /></label><label className="cart-wide">Teléfono<input value={customer.phone} onChange={(event) => updateCustomer('phone', event.target.value)} placeholder="Ej. 11 1234 5678" type="tel" inputMode="tel" autoComplete="tel" required /></label></div>
          <fieldset className="delivery-choices">
            <legend>¿Cómo querés recibir tu compra?</legend>
            {DELIVERY_OPTIONS.map((option) => {
              const details = deliveryDetails(option.label, deliverySettings)
              return <label key={option.mode} className={customer.delivery === option.label ? 'is-selected' : ''}>
                <input type="radio" name="cart-delivery" value={option.label} checked={customer.delivery === option.label} onChange={() => { updateCustomer('delivery', option.label); setCustomer((current) => ({ ...current, address: '' })) }} />
                <span className="delivery-choice-content"><span className="delivery-choice-title">{option.label}</span><span className="delivery-choice-price">{details.cost ? `$ ${details.cost.toLocaleString('es-AR')}` : 'Sin cargo'}</span>{option.mode === 'pickup' && <span className="delivery-choice-description">{details.pickupAddress}{details.pickupHours && <><br />{details.pickupHours}</>}</span>}</span>
              </label>
            })}
          </fieldset>
          {deliveryState !== 'ready' && <p className="delivery-help" role="status">{deliveryState === 'loading' ? 'Cargando opciones de entrega…' : 'No pudimos verificar las opciones de entrega. Actualizá la página para intentar nuevamente.'}</p>}
          {delivery.mode !== 'pickup' && <p className="delivery-help">El envío se paga junto con las prendas. {delivery.instructions}</p>}
          <div className="cart-customer">
            {delivery.mode !== 'pickup' && <label className="cart-wide">{delivery.mode === 'branch' ? 'Sucursal o localidad (opcional)' : 'Dirección de envío (opcional)'}<input value={customer.address} onChange={(event) => updateCustomer('address', event.target.value)} maxLength={300} placeholder={delivery.mode === 'branch' ? 'Podés indicarla ahora o coordinarla después' : 'Calle, altura y localidad'} autoComplete={delivery.mode === 'home' ? 'street-address' : 'off'} /></label>}
            <label className="cart-wide">Notas para el pedido<textarea value={customer.notes} onChange={(event) => updateCustomer('notes', event.target.value)} maxLength={1000} placeholder="Opcional" rows="2" /></label>
          </div>
          <fieldset className="payment-choices"><legend>¿Cómo querés pagar?</legend><label className={selectedPayment === 'mercadopago' ? 'is-selected' : ''}><input type="radio" name="payment-method" checked={selectedPayment === 'mercadopago'} onChange={() => setPaymentMethod('mercadopago')} /><span>Mercado Pago<small>Tarjeta de crédito o débito. Las cuotas disponibles se muestran al pagar.</small></span></label>{transferEnabled && <label className={selectedPayment === 'transfer' ? 'is-selected' : ''}><input type="radio" name="payment-method" checked={selectedPayment === 'transfer'} onChange={() => setPaymentMethod('transfer')} /><span>Transferencia bancaria<small>{payments.transferDiscountPercent > 0 ? payments.transferDiscountPercent + '% de descuento en las prendas. No acumulable con cupones.' : 'El alias y el titular aparecen al confirmar el pedido.'}</small></span></label>}</fieldset>
          <OrderTotals transferSaving={transferSaving} subtotal={couponTotals ? couponTotals.subtotal : subtotal} discount={couponTotals?.discount || 0} shipping={delivery.cost} pickup={delivery.mode === 'pickup'} total={total} couponCode={appliedCouponCode} />
          {paymentConflict && <p className="cart-customer-error" role="alert">El descuento por transferencia no se acumula con cupones. Quitá el código o elegí Mercado Pago.</p>}
          {checkoutValidationError && <p className="cart-customer-error" role="alert">{checkoutValidationError}</p>}
          <button className={`checkout-button ${selectedPayment === 'transfer' ? 'is-transfer' : ''}`} type="button" onClick={beginCheckout} disabled={deliveryState !== 'ready' || paymentConflict}>{selectedPayment === 'transfer' ? 'Continuar con transferencia' : 'Pagar con Mercado Pago'} <span>→</span></button>
          <p>{selectedPayment === 'transfer' ? 'El pedido se confirma después de verificar la acreditación.' : 'Pago seguro procesado por Mercado Pago.'}</p>
        </footer>
      </> : <div className="empty-cart"><span>◌</span><h3>Tu carrito está vacía.</h3><p>Encontrá tu próxima favorita en nuestro catálogo.</p><button onClick={onClose}>Seguir viendo la tienda</button></div>}
    </aside>
  </div>
}

export function CatalogProductOptions({ product, onClose, onAdd, paymentSettings }) {
  const { sizes, colors } = productOptions(product)
  const images = productImages(product)
  const initialColor = colors.find((entry) => (sizes.length ? sizes : ['']).some((item) => availableStock(product, item, entry.name) > 0)) || colors[0] || null
  const [size, setSize] = useState(() => sizes.length === 1 && availableStock(product, sizes[0], initialColor?.name || '') > 0 ? sizes[0] : '')
  const [color, setColor] = useState(() => initialColor)
  const [photo, setPhoto] = useState(() => Math.max(0, images.findIndex((image) => image.color === initialColor?.name)))
  const [zoom, setZoom] = useState(false)
  const [feedback, setFeedback] = useState('')
  const dialogRef = useDialogFocus(Boolean(product), () => zoom ? setZoom(false) : onClose())
  const imageButton = useRef(null)
  const zoomButton = useRef(null)
  useEffect(() => { if (zoom) zoomButton.current?.focus() }, [zoom])

  if (!product) return null

  const selectedSize = sizes.includes(size) ? size : ''
  const selectedColor = colors.find((entry) => entry.name === color?.name) || colors[0] || null
  const hasSelection = (!sizes.length || Boolean(selectedSize)) && (!colors.length || Boolean(selectedColor))
  const remaining = availableStock(product, selectedSize, selectedColor?.name || '')
  const selectedPhoto = images[Math.min(photo, Math.max(0, images.length - 1))]
  const colorAvailable = (name) => (sizes.length ? sizes : ['']).some((entry) => availableStock(product, entry, name) > 0)
  const chooseColor = (entry) => {
    setColor(entry); setFeedback('')
    if (availableStock(product, selectedSize, entry.name) < 1) setSize('')
    const index = images.findIndex((image) => image.color === entry.name)
    if (index >= 0) setPhoto(index)
  }
  const showPhoto = (index) => {
    const photoColor = colors.find((entry) => entry.name === images[index]?.color)
    if (photoColor) chooseColor(photoColor)
    setPhoto(index)
  }
  const movePhoto = (direction) => showPhoto((photo + direction + images.length) % images.length)
  const closeZoom = () => { setZoom(false); requestAnimationFrame(() => imageButton.current?.focus()) }
  const arrow = (direction) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={direction < 0 ? 'M20 12H4m7-7-7 7 7 7' : 'M4 12h16m-7-7 7 7-7 7'} /></svg>
  const closeIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>

  return <div className="catalog-options-layer" role="presentation">
    <button className="catalog-options-backdrop" type="button" aria-label="Cerrar opciones del producto" onClick={onClose} />
    <section ref={dialogRef} tabIndex={-1} className={`catalog-options-dialog product-details-dialog ${zoom ? 'is-zoomed' : ''}`} role="dialog" aria-modal="true" aria-labelledby="catalog-options-title">
      <header><h2 id="catalog-options-title">{product.title}</h2><button ref={zoomButton} type="button" aria-label={zoom ? 'Volver al producto' : 'Cerrar'} onClick={zoom ? closeZoom : onClose}>{closeIcon}</button></header>
      <div className="product-detail-layout">
        <div className="product-gallery" onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight'].includes(event.key) && images.length > 1) { event.preventDefault(); movePhoto(event.key === 'ArrowLeft' ? -1 : 1) } }}>
          {selectedPhoto ? <button ref={imageButton} type="button" className="product-gallery-main" aria-label={zoom ? 'Reducir foto' : 'Ampliar foto de la prenda'} onClick={() => zoom ? closeZoom() : setZoom(true)}><img src={selectedPhoto.imageUrl} alt={`${product.title}${selectedPhoto.color ? `, ${selectedPhoto.color}` : ''}, foto ${photo + 1}`} /><span>{zoom ? 'Reducir foto' : 'Ampliar foto'}</span></button> : <div className="product-gallery-empty">Foto próximamente</div>}
          {selectedPhoto?.color && <p className="product-photo-caption">Color de la foto: {selectedPhoto.color}</p>}
          {images.length > 1 && <>
            <div className="product-gallery-controls"><button type="button" aria-label="Foto anterior" onClick={() => movePhoto(-1)}>{arrow(-1)}</button><span role="status">Foto {photo + 1} de {images.length}</span><button type="button" aria-label="Foto siguiente" onClick={() => movePhoto(1)}>{arrow(1)}</button></div>
            <div className="product-gallery-thumbnails" aria-label="Fotos de la prenda">{images.map((image, index) => <button type="button" key={image.imageUrl} aria-label={`Ver foto ${index + 1}${image.color ? `, ${image.color}` : ''}`} aria-pressed={photo === index} onClick={() => showPhoto(index)}><img src={image.imageUrl} alt="" loading="lazy" /></button>)}</div>
          </>}
        </div>
        {!zoom && <div className="product-detail-info">
          <ProductPrice product={product} paymentSettings={paymentSettings} />
          {product.description && <p className="catalog-detail-description">{product.description}</p>}
          {colors.length > 0 && <fieldset><legend>Color: {selectedColor?.name}</legend><div className="catalog-color-buttons">{colors.map((item) => <button type="button" key={item.name} className={selectedColor?.name === item.name ? 'is-selected' : ''} aria-pressed={selectedColor?.name === item.name} disabled={!colorAvailable(item.name)} title={colorAvailable(item.name) ? item.name : `${item.name}: sin stock`} onClick={() => chooseColor(item)}><i aria-hidden="true" style={{ backgroundColor: item.value }} />{item.name}</button>)}</div></fieldset>}
          {sizes.length > 0 && <fieldset><legend>Talle</legend><div className="catalog-option-buttons">{sizes.map((item) => <button type="button" key={item} className={selectedSize === item ? 'is-selected' : ''} aria-pressed={selectedSize === item} disabled={availableStock(product, item, selectedColor?.name || '') < 1} title={availableStock(product, item, selectedColor?.name || '') < 1 ? `Talle ${item}: sin stock en este color` : `Talle ${item}`} onClick={() => { setSize(item); setFeedback('') }}>{item}</button>)}</div></fieldset>}
          <p className="product-stock-note" role="status">{!hasSelection ? 'Elegí un talle disponible para este color.' : remaining < 1 ? 'Sin stock en esta combinación. Elegí otro talle o color.' : product.trackStock ? `${remaining} ${remaining === 1 ? 'unidad disponible' : 'unidades disponibles'}` : 'Prenda disponible para agregar al carrito.'}</p>
          {hasSelection && (selectedColor || selectedSize) && <p className="product-selection-summary">Tu elección: {[selectedColor?.name, selectedSize && `Talle ${selectedSize}`].filter(Boolean).join(' · ')}</p>}
          <button className="catalog-options-add" type="button" disabled={!hasSelection || remaining < 1} onClick={() => { const error = onAdd({ size: selectedSize, color: selectedColor }); if (error) setFeedback(error) }}>Agregar al carrito {arrow(1)}</button>
          {feedback && <p className="product-stock-note" role="alert">{feedback}</p>}
        </div>}
      </div>
    </section>
  </div>
}
