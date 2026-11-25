import { FieldValue } from './firebase-admin.js'
import { CATALOG, CheckoutError, isFinalMercadoPagoOrder, shouldRedeemCouponUse, settleCouponUse } from './checkout.js'
import { availableStock, variantKey } from '../src/productInventory.js'
import { productPricing } from '../src/paymentSettings.js'

function groups(items) {
  const result = new Map()
  for (const item of items) {
    if (item.kind !== 'product') continue
    const key = JSON.stringify([item.productId, variantKey(item.size, item.color)])
    const current = result.get(key)
    result.set(key, { productId: item.productId, size: item.size || '', color: item.color || '', quantity: (current?.quantity || 0) + item.quantity, unitPrice: item.unitPrice })
  }
  return [...result.values()]
}

export async function reserveInventory({ db, items, reference, attemptId = '', transferOrderRef = null }) {
  if (!db) return false
  const requested = groups(items)
  const reservationRef = db.collection('inventoryReservations').doc(reference)
  return db.runTransaction(async (transaction) => {
    if (transferOrderRef && (await transaction.get(transferOrderRef)).data()?.status !== 'creating_transfer') throw new CheckoutError('El pedido no se puede reservar. Volvé a intentarlo.', 'TRANSFER_CLOSED', 409)
    const previous = await transaction.get(reservationRef)
    if (previous.exists) return previous.data().state === 'reserved'
    const productIds = [...new Set(requested.map((item) => item.productId))]
    const snapshots = await Promise.all(productIds.map((id) => transaction.get(db.collection('products').doc(id))))
    const products = new Map(snapshots.map((snapshot) => [snapshot.id, { ref: snapshot.ref, data: snapshot.exists ? snapshot.data() : null }]))
    const held = []
    const updates = new Map()
    for (const item of requested) {
      const product = products.get(item.productId)
      const data = product.data
      if (data?.hidden || (!data && !CATALOG[item.productId])) throw new CheckoutError('Una prenda ya no está disponible. Revisá tu carrito.', 'PRODUCT_UNAVAILABLE', 409)
      if (productPricing({ ...CATALOG[item.productId], ...data }).price !== item.unitPrice) throw new CheckoutError('El precio de una prenda cambió. Volvé a agregarla al carrito.', 'PRODUCT_CHANGED', 409)
      if (!data?.trackStock) continue
      if (availableStock(data, item.size, item.color) < item.quantity) throw new CheckoutError(`No hay suficientes unidades de ${data.title || 'esta prenda'}${item.size ? `, talle ${item.size}` : ''}${item.color ? `, ${item.color}` : ''}. Revisá tu carrito.`, 'STOCK_UNAVAILABLE', 409)
      const variants = updates.get(item.productId) || structuredClone(data.variants || [])
      const row = variants.find((entry) => variantKey(entry.size, entry.color) === variantKey(item.size, item.color))
      if (!row) throw new CheckoutError('Esta combinación ya no tiene stock.', 'STOCK_UNAVAILABLE', 409)
      row.reserved = Number(row.reserved || 0) + item.quantity
      updates.set(item.productId, variants)
      held.push(item)
    }
    if (!held.length) return false
    for (const [id, variants] of updates) transaction.update(products.get(id).ref, { variants, updatedAt: FieldValue.serverTimestamp() })
    transaction.create(reservationRef, { state: 'reserved', items: held, reference, attemptId, createdAt: FieldValue.serverTimestamp() })
    return true
  })
}

export async function claimPaymentSubmission(db, attemptId) {
  const ref = db.collection('checkoutAttempts').doc(attemptId)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists || snapshot.data().state !== 'created') throw new CheckoutError('El intento de compra venció. Volvé a intentar el pago.', 'CHECKOUT_CAN_RETRY', 409)
    transaction.update(ref, { state: 'submitting', updatedAt: FieldValue.serverTimestamp() })
  })
}

// Recovery after a temporary database failure. Never free a payment already
// submitted merely because time elapsed: an unknown result stays on hold.
export async function reconcileInventoryReservation({ db, reservation, accessToken = '', now = Date.now() }) {
  const { reference, attemptId } = reservation
  const settle = async (paid) => {
    await settleCouponUse({ db, externalReference: reference, paid })
    await settleInventory({ db, reference, paid })
  }
  const [orderSnapshot, attemptSnapshot] = await Promise.all([
    db.collection('orders').doc(reference).get(),
    attemptId ? db.collection('checkoutAttempts').doc(attemptId).get() : Promise.resolve(null),
  ])
  const order = orderSnapshot.data() || {}
  // Manual transfers are reconciled through their own state machine. A
  // receipt or elapsed time can never confirm or release a pending transfer.
  if (order.paymentMethod === 'transfer') return
  const state = { status: order.status, status_detail: order.statusDetail }
  if (isFinalMercadoPagoOrder(state)) {
    await settle(shouldRedeemCouponUse(state))
    return
  }
  if (order.mercadoPagoOrderId && accessToken) {
    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(order.mercadoPagoOrderId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(4000) })
    if (response.ok) {
      const verified = await response.json()
      if (verified.external_reference === reference && isFinalMercadoPagoOrder(verified)) {
        await settle(shouldRedeemCouponUse(verified))
        return
      }
    }
  }
  if (!attemptSnapshot?.exists) return
  const attempt = attemptSnapshot.data()
  if (attempt.state === 'failed') {
    await settle(false)
    return
  }
  const createdAt = attempt.createdAt?.toMillis?.() || (attempt.createdAt instanceof Date ? attempt.createdAt.getTime() : 0)
  if (attempt.state !== 'created' || !createdAt || now - createdAt < 15 * 60 * 1000) return
  const abandoned = await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(attemptSnapshot.ref)
    if (latest.data()?.state !== 'created') return false
    transaction.update(attemptSnapshot.ref, { state: 'failed', errorCode: 'CHECKOUT_ABANDONED', updatedAt: FieldValue.serverTimestamp() })
    return true
  })
  if (abandoned) await settle(false)
}

// Both the immediate response and signed webhook may arrive, in either order.
// The reservation and quantities are settled in the same transaction exactly once.
export async function settleInventory({ db, reference, paid }) {
  if (!db || !reference) return
  const ref = db.collection('inventoryReservations').doc(reference)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists || snapshot.data().state !== 'reserved') return
    const items = snapshot.data().items || []
    const ids = [...new Set(items.map((item) => item.productId))]
    const products = await Promise.all(ids.map((id) => transaction.get(db.collection('products').doc(id))))
    const updates = new Map(products.map((product) => [product.id, { ref: product.ref, variants: structuredClone(product.data()?.variants || []) }]))
    for (const item of items) {
      const product = updates.get(item.productId)
      const row = product.variants.find((entry) => variantKey(entry.size, entry.color) === variantKey(item.size, item.color))
      if (!row || Number(row.reserved) < item.quantity || (paid && Number(row.stock) < item.quantity)) throw new Error('La reserva de stock necesita revisión.')
      row.reserved -= item.quantity
      if (paid) row.stock -= item.quantity
    }
    for (const { ref: productRef, variants } of updates.values()) transaction.update(productRef, { variants, updatedAt: FieldValue.serverTimestamp() })
    transaction.update(ref, { state: paid ? 'sold' : 'released', settledAt: FieldValue.serverTimestamp() })
  })
}
