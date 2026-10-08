import { createHash } from 'node:crypto'
import { FieldValue } from './firebase-admin.js'

export const CUSTOM_SHIRT_PRICE = 18900

export const CATALOG = {
  'remeron-yorkie-bandana': { title: 'Remerón Yorkie Bandana', price: 12000 },
  'remeron-golden-girasoles': { title: 'Remerón Golden Girasoles', price: 12000 },
  'remeron-gato-limon': { title: 'Remerón Gato Limón', price: 12000 },
  'remeron-perro-cafe': { title: 'Remerón Perro Café', price: 12000 },
  'remeron-salchicha-retro': { title: 'Remerón Salchicha Retro', price: 12000 },
  'remeron-a-ganar-lo-que-debo': { title: 'Remerón A Ganar Lo Que Debo', price: 12000 },
  'remeron-snoopy-bakery': { title: 'Remerón Snoopy Bakery', price: 12000 },
  'remeron-pug-cool': { title: 'Remerón Pug Cool', price: 12000 },
  'remeron-la-dolce-vita': { title: 'Remerón La Dolce Vita', price: 12000 },
}

export class CheckoutError extends Error {
  constructor(message, code = 'CHECKOUT_INVALID', status = 400) {
    super(message)
    this.name = 'CheckoutError'
    this.code = code
    this.status = status
  }
}

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null
}

function validProductId(value) {
  const id = String(value || '').trim()
  return /^[a-z0-9][a-z0-9-]{0,99}$/i.test(id) ? id : ''
}

function validQuantity(value) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 10 ? quantity : null
}

function safeTitle(value, fallback) {
  const title = String(value || '').trim().replace(/\s+/g, ' ')
  return title && title.length <= 160 ? title : fallback
}

/**
 * Price every cart item on the server. Firestore products take priority so new
 * products created from the admin panel work without changing this file; the
 * original static catalog remains a safe fallback during the migration.
 */
export async function calculateCart(cart, db = null) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 20) {
    throw new CheckoutError('La bolsa no es válida.')
  }

  const normalized = cart.map((item) => {
    const quantity = validQuantity(item?.quantity)
    if (!quantity) throw new CheckoutError('La cantidad elegida no es válida.')

    if (item?.kind === 'custom') {
      return { kind: 'custom', quantity, unitPrice: CUSTOM_SHIRT_PRICE, title: 'Remera personalizada', productId: null }
    }

    const productId = validProductId(item?.productId)
    if (!productId) throw new CheckoutError('Uno de los productos cambió. Quitalo de la bolsa y volvé a agregarlo para pagar.')
    return { kind: 'product', quantity, productId }
  })

  const productIds = [...new Set(normalized.filter((item) => item.kind === 'product').map((item) => item.productId))]
  const firestoreProducts = new Map()

  if (db && productIds.length) {
    try {
      const snapshots = await Promise.all(productIds.map((id) => db.collection('products').doc(id).get()))
      snapshots.forEach((snapshot) => {
        if (snapshot.exists) firestoreProducts.set(snapshot.id, snapshot.data())
      })
    } catch {
      // If the private catalogue cannot be read, stop the checkout instead of
      // accidentally selling a product with an old price or availability.
      throw new CheckoutError('No pudimos verificar los productos de tu bolsa. Probá nuevamente en unos minutos.', 'PRODUCTS_UNAVAILABLE', 503)
    }
  }

  const items = normalized.map((item) => {
    if (item.kind === 'custom') return { ...item, lineTotal: item.unitPrice * item.quantity }

    const firestoreProduct = firestoreProducts.get(item.productId)
    const catalogProduct = CATALOG[item.productId]
    if (firestoreProduct?.hidden === true) {
      throw new CheckoutError('Uno de los productos ya no está disponible. Quitalo de la bolsa y volvé a agregarlo para pagar.', 'PRODUCT_UNAVAILABLE')
    }

    const unitPrice = money(firestoreProduct?.price) ?? catalogProduct?.price
    if (!unitPrice) {
      throw new CheckoutError('Uno de los productos cambió. Quitalo de la bolsa y volvé a agregarlo para pagar.', 'PRODUCT_CHANGED')
    }

    return {
      kind: 'product',
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      title: safeTitle(firestoreProduct?.title, catalogProduct?.title || 'Producto de Fenixis'),
      lineTotal: unitPrice * item.quantity,
    }
  })

  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0)
  return { items, subtotal }
}

export function normalizeCouponCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return ''
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
    throw new CheckoutError('El código promocional tiene un formato inválido.', 'COUPON_FORMAT')
  }
  return code
}

function timeValue(value) {
  if (value === undefined || value === null || value === '') return null
  const time = typeof value?.toDate === 'function'
    ? value.toDate().getTime()
    : value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
        ? value
        : Date.parse(value)
  if (!Number.isFinite(time)) throw new CheckoutError('La configuración del cupón no es válida.', 'COUPON_CONFIG')
  return time
}

function optionalWholeNumber(value, _field) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new CheckoutError('La configuración del cupón no es válida.', 'COUPON_CONFIG')
  return number
}

function optionalMoney(value) {
  if (value === undefined || value === null || value === '') return null
  const amount = money(value)
  if (amount === null) throw new CheckoutError('La configuración del cupón no es válida.', 'COUPON_CONFIG')
  return amount
}

function couponProductScope(data) {
  const appliesTo = data.appliesTo
  if (appliesTo === undefined || appliesTo === null || appliesTo === '' || appliesTo === 'all') return { type: 'all', productIds: [] }

  const productIds = Array.isArray(appliesTo)
    ? appliesTo
    : Array.isArray(data.productIds)
      ? data.productIds
      : Array.isArray(appliesTo?.productIds)
        ? appliesTo.productIds
        : []

  if (appliesTo?.scope === 'all' || appliesTo === 'all_products') return { type: 'all', productIds: [] }
  if (!productIds.length) return { type: 'products', productIds: [] }
  return { type: 'products', productIds: [...new Set(productIds.map(validProductId).filter(Boolean))] }
}

function parseCoupon(snapshot, expectedCode) {
  const data = snapshot.data() || {}
  const code = normalizeCouponCode(data.codeNormalized || data.code || snapshot.id)
  if (code !== expectedCode) throw new CheckoutError('El código promocional no es válido.', 'COUPON_NOT_FOUND')
  if (data.active === false) throw new CheckoutError('Este código promocional ya no está activo.', 'COUPON_INACTIVE')

  const type = data.type === 'fixed' ? 'fixed' : data.type === 'percentage' ? 'percentage' : null
  const value = money(data.value ?? data.discountValue ?? (data.type === 'percentage' ? data.percent : data.amount))
  const campaignId = String(data.campaignId || '').trim()
  if (!type || value === null || value <= 0 || (type === 'percentage' && value > 100)) {
    throw new CheckoutError('La configuración del cupón no es válida.', 'COUPON_CONFIG')
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(campaignId)) {
    throw new CheckoutError('Este código necesita guardarse nuevamente desde el panel.', 'COUPON_CONFIG')
  }

  return {
    id: snapshot.id,
    ref: snapshot.ref,
    campaignId,
    code,
    title: safeTitle(data.title, `Código ${code}`),
    active: data.active !== false,
    type,
    value,
    startsAt: timeValue(data.startsAt),
    expiresAt: timeValue(data.expiresAt),
    maxUses: optionalWholeNumber(data.maxUses, 'maxUses'),
    usageCount: optionalWholeNumber(data.usageCount ?? data.uses, 'usageCount') || 0,
    reservedUses: optionalWholeNumber(data.reservedUses, 'reservedUses') || 0,
    perCustomerLimit: optionalWholeNumber(data.perCustomerLimit, 'perCustomerLimit'),
    minPurchase: optionalMoney(data.minPurchase) ?? 0,
    scope: couponProductScope(data),
  }
}

async function findCoupon(db, code) {
  const direct = await db.collection('coupons').doc(code).get()
  if (direct.exists) return direct

  const normalized = await db.collection('coupons').where('codeNormalized', '==', code).limit(2).get()
  if (normalized.size === 1) return normalized.docs[0]
  if (normalized.size > 1) throw new CheckoutError('El código promocional no está disponible. Contactanos.', 'COUPON_AMBIGUOUS')

  const legacy = await db.collection('coupons').where('code', '==', code).limit(2).get()
  if (legacy.size === 1) return legacy.docs[0]
  if (legacy.size > 1) throw new CheckoutError('El código promocional no está disponible. Contactanos.', 'COUPON_AMBIGUOUS')
  throw new CheckoutError('El código promocional no existe.', 'COUPON_NOT_FOUND')
}

function applyCoupon(coupon, cart, now = Date.now()) {
  if (coupon.startsAt && now < coupon.startsAt) throw new CheckoutError('Este código todavía no está vigente.', 'COUPON_NOT_STARTED')
  if (coupon.expiresAt && now >= coupon.expiresAt) throw new CheckoutError('Este código promocional venció.', 'COUPON_EXPIRED')
  if (coupon.maxUses !== null && coupon.usageCount + coupon.reservedUses >= coupon.maxUses) {
    throw new CheckoutError('Este código alcanzó su límite de usos.', 'COUPON_LIMIT_REACHED')
  }
  if (cart.subtotal < coupon.minPurchase) {
    throw new CheckoutError(`Este código requiere una compra mínima de $ ${coupon.minPurchase.toLocaleString('es-AR')}.`, 'COUPON_MIN_PURCHASE')
  }

  const eligibleSubtotal = coupon.scope.type === 'all'
    ? cart.subtotal
    : cart.items.filter((item) => item.kind === 'product' && coupon.scope.productIds.includes(item.productId)).reduce((total, item) => total + item.lineTotal, 0)

  if (!eligibleSubtotal) throw new CheckoutError('Este código no aplica a los productos de tu bolsa.', 'COUPON_NOT_APPLICABLE')

  const discount = coupon.type === 'percentage'
    ? Math.round((eligibleSubtotal * coupon.value) / 100)
    : Math.min(coupon.value, eligibleSubtotal)

  if (!discount) throw new CheckoutError('Este código no genera un descuento válido.', 'COUPON_CONFIG')
  if (cart.subtotal - discount <= 0) {
    throw new CheckoutError('Este código debe dejar un total mayor a $ 0 para poder pagar con Mercado Pago.', 'COUPON_ZERO_TOTAL')
  }

  return {
    coupon: {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.type,
      discountValue: coupon.value,
      discountAmount: discount,
      eligibleSubtotal,
    },
    totals: { subtotal: cart.subtotal, discount, total: cart.subtotal - discount },
  }
}

export async function quoteCheckout({ db, cart, couponCode, reconcileReservations = false }) {
  const calculation = await calculateCart(cart, db)
  const code = normalizeCouponCode(couponCode)
  if (!code) return { ...calculation, coupon: null, totals: { subtotal: calculation.subtotal, discount: 0, total: calculation.subtotal } }
  if (!db) throw new CheckoutError('Los códigos promocionales todavía no están configurados.', 'COUPONS_NOT_CONFIGURED', 503)

  let snapshot = await findCoupon(db, code)
  let coupon = parseCoupon(snapshot, code)
  // Before accepting a limited code for a new payment, settle any older
  // reservation whose local Mercado Pago result is already final. This keeps
  // a transient Firestore write failure from blocking a promotion forever.
  if (reconcileReservations) {
    await reconcileCouponReservations({ db, campaignId: coupon.campaignId })
    snapshot = await snapshot.ref.get()
    if (!snapshot.exists) throw new CheckoutError('El código promocional ya no existe.', 'COUPON_NOT_FOUND')
    coupon = parseCoupon(snapshot, code)
  }
  const quote = applyCoupon(coupon, calculation)
  return { ...calculation, ...quote, couponRef: snapshot.ref }
}

/**
 * Coupon redemption records deliberately store a hash, never a buyer's email.
 * That lets a per-person limit work without putting personal data in a public
 * or admin-facing coupon document.
 */
export function couponCustomerKey(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || normalized.length > 254) return ''
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Retries local settlement of already-terminal payments for this promotion.
 * Unknown provider outcomes are deliberately left reserved: releasing those
 * automatically could let the same last coupon use pay twice.
 */
export async function reconcileCouponReservations({ db, campaignId, limit = 25 }) {
  if (!db || !campaignId) return
  const reservations = await db.collection('couponReservations')
    .where('couponCampaignId', '==', campaignId)
    .limit(limit)
    .get()

  await Promise.all(reservations.docs.map(async (reservation) => {
    const data = reservation.data() || {}
    if (data.state !== 'reserved') return
    const order = await db.collection('orders').doc(reservation.id).get()
    if (!order.exists) return
    const orderData = order.data() || {}
    if (!isFinalMercadoPagoOrder(orderData)) return
    await settleCouponUse({
      db,
      externalReference: reservation.id,
      paid: shouldRedeemCouponUse(orderData),
    })
  }))
}

/**
 * Holds one allowed use while Mercado Pago processes a limited coupon. The
 * hold prevents two simultaneous checkouts from spending its last use.
 */
export async function reserveCouponUse({ db, quote, externalReference, customerKey = '' }) {
  if (!quote.coupon) return null

  const reservationRef = db.collection('couponReservations').doc(externalReference)
  await db.runTransaction(async (transaction) => {
    const [couponSnapshot, reservation] = await Promise.all([
      transaction.get(quote.couponRef),
      transaction.get(reservationRef),
    ])
    if (reservation.exists) throw new CheckoutError('No pudimos reservar el código promocional. Probá nuevamente.', 'COUPON_RESERVATION')
    if (!couponSnapshot.exists) throw new CheckoutError('El código promocional ya no existe.', 'COUPON_NOT_FOUND')

    const coupon = parseCoupon(couponSnapshot, quote.coupon.code)
    const refreshed = applyCoupon(coupon, { items: quote.items, subtotal: quote.subtotal })
    if (refreshed.totals.discount !== quote.totals.discount) {
      throw new CheckoutError('La promoción cambió. Revisá el total e intentá de nuevo.', 'COUPON_CHANGED')
    }

    const needsCustomerLimit = coupon.perCustomerLimit !== null
    const redemptionRef = needsCustomerLimit ? db.collection('couponRedemptions').doc(`${coupon.campaignId}--${customerKey}`) : null
    let redemption = null
    if (needsCustomerLimit) {
      if (!customerKey) throw new CheckoutError('No pudimos verificar el límite de este código. Revisá el email de pago.', 'COUPON_CUSTOMER')
      redemption = await transaction.get(redemptionRef)
      const redemptionData = redemption.data() || {}
      const customerUses = optionalWholeNumber(redemptionData.usageCount, 'usageCount') || 0
      const customerReserved = optionalWholeNumber(redemptionData.reservedUses, 'reservedUses') || 0
      if (customerUses + customerReserved >= coupon.perCustomerLimit) {
        throw new CheckoutError('Ya alcanzaste el límite de uso de este código.', 'COUPON_CUSTOMER_LIMIT')
      }
    }

    transaction.update(quote.couponRef, {
      reservedUses: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.set(reservationRef, {
      couponId: coupon.id,
      couponCampaignId: coupon.campaignId,
      couponCode: coupon.code,
      state: 'reserved',
      ...(needsCustomerLimit ? { customerKey } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    if (redemptionRef) {
      transaction.set(redemptionRef, {
        couponId: coupon.id,
        couponCampaignId: coupon.campaignId,
        customerKey,
        reservedUses: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        ...(redemption?.exists ? {} : { usageCount: 0, createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true })
    }
  })

  return reservationRef
}

export async function settleCouponUse({ db, externalReference, paid }) {
  if (!db) return
  const reservationRef = db.collection('couponReservations').doc(externalReference)

  await db.runTransaction(async (transaction) => {
    const reservation = await transaction.get(reservationRef)
    if (!reservation.exists || reservation.data()?.state !== 'reserved') return

    const reservationData = reservation.data() || {}
    const couponRef = db.collection('coupons').doc(reservationData.couponId)
    const customerKey = String(reservationData.customerKey || '')
    const campaignId = String(reservationData.couponCampaignId || '')
    const redemptionRef = customerKey && campaignId ? db.collection('couponRedemptions').doc(`${campaignId}--${customerKey}`) : null
    const [coupon, redemption] = await Promise.all([
      transaction.get(couponRef),
      redemptionRef ? transaction.get(redemptionRef) : Promise.resolve(null),
    ])
    // A coupon can be deleted and recreated with the same visible code. Only
    // touch the original campaign so an old payment cannot affect the new one.
    if (coupon.exists && coupon.data()?.campaignId === campaignId) {
      const currentReserved = optionalWholeNumber(coupon.data()?.reservedUses, 'reservedUses') || 0
      const currentUses = optionalWholeNumber(coupon.data()?.usageCount ?? coupon.data()?.uses, 'usageCount') || 0
      transaction.update(couponRef, {
        reservedUses: Math.max(0, currentReserved - 1),
        ...(paid ? { usageCount: currentUses + 1 } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    if (redemptionRef && redemption?.exists) {
      const redemptionData = redemption.data() || {}
      const currentReserved = optionalWholeNumber(redemptionData.reservedUses, 'reservedUses') || 0
      const currentUses = optionalWholeNumber(redemptionData.usageCount, 'usageCount') || 0
      transaction.update(redemptionRef, {
        reservedUses: Math.max(0, currentReserved - 1),
        ...(paid ? { usageCount: currentUses + 1 } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    transaction.update(reservationRef, {
      state: paid ? 'redeemed' : 'released',
      settledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

export function checkoutErrorPayload(error, fallbackTotals = null) {
  return {
    valid: false,
    code: error?.code || 'CHECKOUT_INVALID',
    message: error?.message || 'No pudimos validar la compra.',
    ...(fallbackTotals ? { totals: fallbackTotals } : {}),
  }
}

export function safeOrderItems(items) {
  return items.map((item) => ({
    kind: item.kind,
    ...(item.productId ? { productId: item.productId } : {}),
    title: item.title,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }))
}

export function safeCustomer(customer, payerEmail) {
  const read = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
  return {
    email: String(payerEmail || '').trim().toLowerCase().slice(0, 254),
    name: read(customer?.name, 120),
    delivery: read(customer?.delivery, 80),
    address: read(customer?.address, 300),
    notes: read(customer?.notes, 1000),
  }
}

export function isPaidMercadoPagoOrder(order) {
  const transaction = order?.transactions?.payments?.[0] || {}
  const status = String(order?.status || transaction.status || '').toLowerCase()
  const detail = String(order?.status_detail || transaction.status_detail || '').toLowerCase()
  return (status === 'processed' && detail === 'accredited') || status === 'approved'
}

/**
 * A coupon is spent as soon as Mercado Pago reached a completed payment
 * lifecycle, even if the sale is later refunded or charged back. This matches
 * a payment that was first approved and only later changed state, and prevents
 * a temporary reservation from getting stuck forever if the first webhook was
 * missed.
 */
export function shouldRedeemCouponUse(order) {
  const transaction = order?.transactions?.payments?.[0] || {}
  const status = String(order?.status || transaction.status || '').toLowerCase()
  const detail = String(order?.status_detail || transaction.status_detail || '').toLowerCase()
  return isPaidMercadoPagoOrder(order)
    || (status === 'processed' && ['partially_refunded', 'refunded'].includes(detail))
    || status === 'refunded'
    || (status === 'charged_back' && ['settled', 'reimbursed'].includes(detail))
}

export function isFinalMercadoPagoOrder(order) {
  const transaction = order?.transactions?.payments?.[0] || {}
  const status = String(order?.status || transaction.status || '').toLowerCase()
  const detail = String(order?.status_detail || transaction.status_detail || '').toLowerCase()
  if (shouldRedeemCouponUse(order)) return true
  // Keep an unknown processed state on hold instead of accidentally releasing
  // a coupon. Mercado Pago's documented completed states are handled above.
  if (status === 'processed') return ['accredited', 'partially_refunded', 'refunded'].includes(detail)
  if (status === 'charged_back') return ['settled', 'reimbursed'].includes(detail)
  return ['rejected', 'cancelled', 'canceled', 'failed', 'expired'].includes(status)
    || ['rejected', 'cancelled', 'canceled', 'failed', 'expired'].includes(detail)
}
