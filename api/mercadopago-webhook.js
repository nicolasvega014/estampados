import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAdminFirestore, FieldValue } from '../server/firebase-admin.js'
import { isFinalMercadoPagoOrder, isPaidMercadoPagoOrder, settleCouponUse, shouldRedeemCouponUse } from '../server/checkout.js'

function send(res, status, body) {
  res.status(status).json(body)
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function readSignature(value) {
  const parts = {}
  String(first(value) || '').split(',').forEach((piece) => {
    const separator = piece.indexOf('=')
    if (separator < 0) return
    const key = piece.slice(0, separator).trim().toLowerCase()
    const partValue = piece.slice(separator + 1).trim()
    if (key && partValue) parts[key] = partValue
  })
  return parts
}

function hasValidSignature(req, secret, dataId) {
  const signature = readSignature(req.headers?.['x-signature'])
  const requestId = String(first(req.headers?.['x-request-id']) || '').trim()
  if (!signature.ts || !signature.v1 || !dataId || !secret) return false

  const manifest = [
    `id:${dataId}`,
    ...(requestId ? [`request-id:${requestId}`] : []),
    `ts:${signature.ts}`,
  ].join(';') + ';'
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  const received = signature.v1
  if (Buffer.byteLength(expected) !== Buffer.byteLength(received)) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

function orderState(order) {
  const transaction = order?.transactions?.payments?.[0] || {}
  return {
    status: String(order?.status || transaction.status || '').toLowerCase(),
    statusDetail: String(order?.status_detail || transaction.status_detail || '').toLowerCase(),
  }
}

async function fetchOrder(accessToken, orderId) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const order = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(order?.message || 'No se pudo verificar la orden de Mercado Pago.')
  return order
}

/**
 * Mercado Pago sends this endpoint signed Order notifications. It uses the
 * official HMAC manifest (`id`, `request-id`, `ts`) and reads the order again
 * from Mercado Pago before changing a coupon or local order record.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método no permitido.' })

  const notificationType = String(req.body?.type || req.query?.type || '').trim().toLowerCase()
  // The URL can safely coexist with other Mercado Pago notifications. Only an
  // Order event belongs to this checkout; unrelated events are acknowledged.
  if (notificationType && !['order', 'orders'].includes(notificationType)) {
    return send(res, 200, { received: true, ignored: true })
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  const dataId = String(req.query?.['data.id'] || req.body?.data?.id || '').trim()
  if (!secret || !accessToken) return send(res, 503, { message: 'Las notificaciones de pago todavía no están configuradas.' })
  if (!hasValidSignature(req, secret, dataId)) return send(res, 401, { message: 'La firma de la notificación no es válida.' })

  try {
    const order = await fetchOrder(accessToken, dataId)
    const reference = String(order?.external_reference || '').trim()
    if (!reference.startsWith('fenixis-')) return send(res, 200, { received: true, ignored: true })

    const db = getAdminFirestore()
    if (!db) return send(res, 503, { message: 'El registro de pagos todavía no está configurado.' })
    const orderRef = db.collection('orders').doc(reference)
    const savedOrder = await orderRef.get()
    if (!savedOrder.exists) return send(res, 200, { received: true, ignored: true })

    const state = orderState(order)
    const paid = isPaidMercadoPagoOrder(order)
    const couponRedeemed = shouldRedeemCouponUse(order)
    const final = isFinalMercadoPagoOrder(order)
    let couponSettlement = savedOrder.data()?.couponSettlement || 'not_applicable'
    if (final) {
      await settleCouponUse({ db, externalReference: reference, paid: couponRedeemed })
      couponSettlement = savedOrder.data()?.coupon ? (couponRedeemed ? 'redeemed' : 'released') : 'not_applicable'
    }

    await orderRef.set({
      mercadoPagoOrderId: String(order?.id || dataId),
      status: state.status || (paid ? 'approved' : 'pending'),
      statusDetail: state.statusDetail || '',
      couponSettlement,
      ...(paid ? { paidAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return send(res, 200, { received: true })
  } catch {
    // A non-2xx response asks Mercado Pago to retry its signed notification.
    return send(res, 500, { message: 'No se pudo registrar la notificación de pago.' })
  }
}
