import { createHash, randomUUID } from 'node:crypto'
import { FieldValue } from './firebase-admin.js'
import { CheckoutError, quoteCheckout, safeCustomer, safeOrderItems, reserveCouponUse, settleCouponUse, couponCustomerKey } from './checkout.js'
import { quoteDelivery } from './delivery.js'
import { reserveInventory, settleInventory } from './inventory.js'
import { notifyPaidOrder, notifyTransferOrder } from './order-email.js'
import { normalizePaymentSettings, transferAvailable, transferDiscount } from '../src/paymentSettings.js'

const hash = (value) => createHash('sha256').update(value).digest('hex')

export function transferResponse(order) {
  return {
    reference: order.reference, status: order.status, total: order.total,
    subtotal: order.subtotal, discount: order.discount, transferDiscount: order.transferDiscount,
    shippingTotal: order.shippingTotal, coupon: order.coupon, items: order.items,
    deliveryDetails: order.deliveryDetails, transferDetails: order.transferDetails,
  }
}

function existingOrder(order) {
  if (['awaiting_transfer', 'approved'].includes(order?.status)) return transferResponse(order)
  if (order?.status === 'creating_transfer') throw new CheckoutError('Estamos guardando este pedido. Esperá un momento y volvé a intentar con el mismo carrito.', 'TRANSFER_IN_PROGRESS', 409)
  throw new CheckoutError('Este intento de pedido ya se cerró. Podés volver a intentarlo desde el carrito.', 'TRANSFER_RETRY', 409)
}

export async function createTransferOrder({ db, body }) {
  const attemptId = String(body.checkoutAttemptId || '')
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(attemptId)) throw new CheckoutError('No pudimos identificar el pedido. Actualizá la página.', 'TRANSFER_ATTEMPT')
  const fingerprint = hash(JSON.stringify([body.cart, body.customer, body.couponCode || '', body.deliveryQuote, body.expectedTotal, body.expectedTransferDiscountPercent]))
  const attemptRef = db.collection('transferAttempts').doc(hash(attemptId))
  const previous = await attemptRef.get()
  if (previous.exists) {
    if (previous.data().fingerprint !== fingerprint) throw new CheckoutError('El carrito cambió. Volvé al carrito para iniciar un nuevo pedido.', 'TRANSFER_ATTEMPT_CHANGED', 409)
    return existingOrder((await db.collection('orders').doc(previous.data().reference).get()).data())
  }
  const settingsSnapshot = await db.collection('settings').doc('store').get()
  const settings = normalizePaymentSettings(settingsSnapshot.data()?.payments)
  if (!transferAvailable(settings)) throw new CheckoutError('La transferencia no está disponible en este momento. Elegí Mercado Pago.', 'TRANSFER_DISABLED', 409)
  if (body.expectedTransferDiscountPercent !== settings.transferDiscountPercent) throw new CheckoutError('El descuento por transferencia cambió. Actualizá el carrito para revisar el total.', 'TRANSFER_CHANGED', 409)
  const buyer = safeCustomer(body.customer)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) throw new CheckoutError('Ingresá un email válido para recibir tu pedido.', 'CUSTOMER_EMAIL')
  if (!/^\d{8,16}$/.test(buyer.phone.replace(/\D/g, ''))) throw new CheckoutError('Ingresá un teléfono válido para contactarte.', 'CUSTOMER_PHONE')
  const garments = await quoteCheckout({ db, cart: body.cart, couponCode: body.couponCode, reconcileReservations: true })
  if (garments.coupon && settings.transferDiscountPercent > 0) throw new CheckoutError('El descuento por transferencia no se acumula con cupones. Quitá el código o elegí Mercado Pago.', 'TRANSFER_COUPON_CONFLICT')
  const saving = transferDiscount(garments.totals.total, settings)
  const quote = await quoteDelivery({ db, quote: { ...garments, totals: { ...garments.totals, transferDiscount: saving, total: garments.totals.total - saving } }, customer: buyer, expectedDelivery: body.deliveryQuote, expectedTotal: body.expectedTotal })
  if (quote.delivery.mode === 'pickup') buyer.address = quote.delivery.pickupAddress
  const reference = `fenixis-transfer-${randomUUID()}`
  const orderRef = db.collection('orders').doc(reference)
  const order = {
    reference, paymentMethod: 'transfer', status: 'creating_transfer', statusDetail: '',
    customer: buyer, customerName: buyer.name, delivery: buyer.delivery,
    deliveryDetails: quote.delivery, shippingTotal: quote.totals.shipping,
    items: safeOrderItems(quote.items), subtotal: quote.totals.subtotal, discount: quote.totals.discount,
    transferDiscount: saving, total: quote.totals.total,
    coupon: quote.coupon ? { code: quote.coupon.code, title: quote.coupon.title, discountAmount: quote.coupon.discountAmount } : null,
    transferDetails: { alias: settings.alias, accountHolder: settings.accountHolder, whatsappNumber: settings.whatsappNumber, discountPercent: settings.transferDiscountPercent },
    transferCreatedAt: Date.now(), transferReconciled: false,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }
  const acquired = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(attemptRef)
    if (current.exists) return current.data()
    transaction.create(attemptRef, { reference, fingerprint, createdAt: FieldValue.serverTimestamp() })
    transaction.create(orderRef, order)
    return null
  })
  if (acquired) {
    if (acquired.fingerprint !== fingerprint) throw new CheckoutError('El carrito cambió. Volvé a intentarlo.', 'TRANSFER_ATTEMPT_CHANGED', 409)
    return existingOrder((await db.collection('orders').doc(acquired.reference).get()).data())
  }
  try {
    await reserveCouponUse({ db, quote, externalReference: reference, customerKey: couponCustomerKey(buyer.email), transferOrderRef: orderRef })
    const inventoryReserved = await reserveInventory({ db, items: quote.items, reference, transferOrderRef: orderRef })
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(orderRef)
      if (current.data()?.status !== 'creating_transfer') throw new CheckoutError('El pedido se cerró antes de confirmar la reserva. Volvé a intentarlo.', 'TRANSFER_RETRY', 409)
      transaction.update(orderRef, { status: 'awaiting_transfer', inventoryReserved, updatedAt: FieldValue.serverTimestamp() })
    })
  } catch (error) {
    // Commit a terminal state before releasing anything. Each reservation
    // checks that same document, so a late invocation cannot recreate holds.
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(orderRef)
      if (current.data()?.status === 'creating_transfer') transaction.update(orderRef, { status: 'failed', updatedAt: FieldValue.serverTimestamp() })
    }).catch(() => {})
    await reconcileTransferOrder({ db, reference }).catch(() => {})
    throw error
  }
  const saved = { ...order, status: 'awaiting_transfer' }
  await notifyTransferOrder({ db, reference, order: saved }).catch(() => {})
  return transferResponse(saved)
}

export async function confirmTransferOrder({ db, reference, confirmedBy }) {
  const ref = db.collection('orders').doc(reference)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const order = snapshot.data()
    if (order?.paymentMethod !== 'transfer') throw new CheckoutError('Este pedido no se paga por transferencia.', 'TRANSFER_ONLY')
    if (order.status === 'approved') return
    if (order.status !== 'awaiting_transfer' || order.fulfillmentStatus === 'cancelado') throw new CheckoutError('Este pedido ya no está pendiente de transferencia.', 'TRANSFER_CLOSED', 409)
    transaction.update(ref, { status: 'approved', statusDetail: '', paidAt: FieldValue.serverTimestamp(), transferConfirmedBy: confirmedBy, transferReconciled: false, updatedAt: FieldValue.serverTimestamp() })
  })
  await reconcileTransferOrder({ db, reference })
}

export async function cancelTransferOrder({ db, reference, reason }) {
  const ref = db.collection('orders').doc(reference)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const order = snapshot.data()
    if (order?.paymentMethod !== 'transfer') throw new CheckoutError('Este pedido no se paga por transferencia.', 'TRANSFER_ONLY')
    transaction.update(ref, {
      ...(order.status === 'approved' ? {} : { status: 'cancelled' }),
      fulfillmentStatus: 'cancelado', cancellationReason: reason, cancelledAt: FieldValue.serverTimestamp(),
      fulfillmentUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    })
  })
  await reconcileTransferOrder({ db, reference })
}

export async function reconcileTransferOrder({ db, reference, now = Date.now() }) {
  const ref = db.collection('orders').doc(reference)
  let order = (await ref.get()).data()
  if (order?.paymentMethod !== 'transfer') return
  if (order.status === 'creating_transfer' && now - Number(order.transferCreatedAt) > 15 * 60 * 1000) {
    await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(ref)
      if (latest.data()?.status === 'creating_transfer') transaction.update(ref, { status: 'failed', updatedAt: FieldValue.serverTimestamp() })
    })
    order = (await ref.get()).data()
  }
  if (order.status === 'awaiting_transfer') { await notifyTransferOrder({ db, reference, order }); return }
  if (!['approved', 'failed', 'cancelled'].includes(order.status)) return
  const paid = order.status === 'approved'
  if (!order.transferReconciled) {
    await settleInventory({ db, reference, paid })
    await settleCouponUse({ db, externalReference: reference, paid })
    await ref.update({ transferReconciled: true, updatedAt: FieldValue.serverTimestamp() })
  }
  if (paid) await notifyPaidOrder({ db, reference, order })
}
