import { FieldValue } from './firebase-admin.js'

const MERCHANT_EMAIL = 'Fenixisstore@gmail.com'
const SENDING_TIMEOUT_MS = 15 * 60 * 1000

function cleanText(value, maximum = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum)
}

function validEmail(value) {
  const email = cleanText(value, 254).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]))
}

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$ ${amount.toLocaleString('es-AR')}` : '—'
}

function customerFrom(order) {
  const customer = order?.customer && typeof order.customer === 'object' ? order.customer : {}
  return {
    name: cleanText(customer.name || order?.customerName, 120),
    email: validEmail(customer.email || order?.customerEmail || order?.email),
    phone: cleanText(customer.phone || order?.customerPhone || order?.phone, 40),
    delivery: cleanText(customer.delivery || order?.delivery, 80),
    address: cleanText(customer.address || order?.address, 300),
    notes: cleanText(customer.notes || order?.notes, 1000),
  }
}

function orderReference(order) {
  return cleanText(order?.reference || order?.id, 120) || 'sin referencia'
}

function itemDescription(item) {
  const quantity = Math.max(1, Number(item?.quantity || 1))
  const title = cleanText(item?.title || (item?.kind === 'custom' ? 'Remera personalizada' : 'Producto'), 160)
  const customDetails = item?.kind === 'custom'
    ? [item?.color && `Color: ${cleanText(item.color, 60)}`, item?.size && `Talle: ${cleanText(item.size, 20)}`, item?.front && `Frente: ${cleanText(item.front, 180)}`, item?.back && `Espalda: ${cleanText(item.back, 180)}`].filter(Boolean)
    : []
  return {
    title,
    quantity,
    details: customDetails,
    total: money(item?.lineTotal ?? Number(item?.unitPrice || 0) * quantity),
  }
}

function orderSummary(order) {
  const customer = customerFrom(order)
  const items = Array.isArray(order?.items) ? order.items.map(itemDescription) : []
  const coupon = order?.coupon && typeof order.coupon === 'object' ? cleanText(order.coupon.code, 64) : ''
  return {
    reference: orderReference(order),
    customer,
    items,
    subtotal: money(order?.subtotal),
    discount: Number(order?.discount) > 0 ? money(order.discount) : '',
    total: money(order?.total ?? order?.subtotal),
    coupon,
  }
}

function plainOrderLines(summary, includeCustomerContact) {
  const lines = [
    `Pedido: ${summary.reference}`,
    '',
    'Prendas:',
    ...(summary.items.length
      ? summary.items.flatMap((item) => [`- ${item.title} · ${item.quantity} u. · ${item.total}`, ...item.details.map((detail) => `  ${detail}`)])
      : ['- El detalle de las prendas no está disponible para este pedido anterior.']),
    '',
    `Subtotal: ${summary.subtotal}`,
    ...(summary.discount ? [`Descuento${summary.coupon ? ` (${summary.coupon})` : ''}: - ${summary.discount}`] : []),
    `Total: ${summary.total}`,
    '',
    `Entrega: ${summary.customer.delivery || 'No indicada'}`,
    `Dirección: ${summary.customer.address || (summary.customer.delivery === 'Retiro por el local' ? 'Retira por el local' : 'No indicada')}`,
  ]
  if (summary.customer.notes) lines.push(`Notas: ${summary.customer.notes}`)
  if (includeCustomerContact) {
    lines.push('', `Cliente: ${summary.customer.name || 'No indicado'}`, `Email: ${summary.customer.email || 'No indicado'}`, `Teléfono: ${summary.customer.phone || 'No indicado'}`)
  }
  return lines
}

function emailHtml(title, intro, lines) {
  return `<main style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1b1b1b"><h1 style="font-size:25px;margin:0 0 16px">${escapeHtml(title)}</h1><p style="line-height:1.55">${escapeHtml(intro)}</p><section style="white-space:pre-line;border:1px solid #e2ded6;padding:20px;margin-top:20px;line-height:1.6;background:#faf9f6">${escapeHtml(lines.join('\n'))}</section><p style="font-size:12px;color:#6d6b66;margin-top:22px">Fenixis Store</p></main>`
}

function sendingStartedAt(notification) {
  const value = notification?.startedAt
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function claimDelivery(orderRef, type, recipient) {
  let claimed = false
  await orderRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef)
    if (!snapshot.exists) return
    const current = snapshot.data()?.emailNotifications?.[type] || {}
    const status = String(current.status || '')
    const stale = status === 'sending' && Date.now() - sendingStartedAt(current) > SENDING_TIMEOUT_MS
    if (status === 'sent' || (status === 'sending' && !stale)) return
    transaction.update(orderRef, {
      [`emailNotifications.${type}`]: {
        status: 'sending',
        recipient,
        startedAt: new Date(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    })
    claimed = true
  })
  return claimed
}

async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = cleanText(process.env.RESEND_API_KEY, 500)
  const from = cleanText(process.env.ORDER_EMAIL_FROM, 320)
  if (!apiKey || !from) return { skipped: true, reason: 'not_configured' }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  })
  if (!response.ok) throw new Error('El servicio de correo no pudo aceptar el mensaje.')
  const result = await response.json().catch(() => ({}))
  return { id: cleanText(result?.id, 160) }
}

async function deliver(orderRef, type, recipient, message) {
  if (!recipient) return { skipped: true, reason: 'missing_recipient' }
  if (!process.env.RESEND_API_KEY || !process.env.ORDER_EMAIL_FROM) return { skipped: true, reason: 'not_configured' }
  if (!await claimDelivery(orderRef, type, recipient)) return { skipped: true, reason: 'already_sent_or_sending' }

  try {
    const sent = await sendResendEmail({ to: recipient, ...message })
    await orderRef.update({
      [`emailNotifications.${type}`]: {
        status: 'sent',
        recipient,
        sentAt: FieldValue.serverTimestamp(),
        ...(sent.id ? { providerId: sent.id } : {}),
      },
      updatedAt: FieldValue.serverTimestamp(),
    })
    return sent
  } catch {
    await orderRef.update({
      [`emailNotifications.${type}`]: {
        status: 'failed',
        recipient,
        failedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {})
    return { skipped: true, reason: 'delivery_failed' }
  }
}

/**
 * Sends one merchant notification and one buyer confirmation after a payment
 * has reached an approved/accredited state. Both deliveries are claimed in
 * Firestore first, so a repeated Mercado Pago webhook cannot duplicate them.
 * No personal data leaves the server unless the Resend credentials are set.
 */
export async function notifyPaidOrder({ db, reference, order }) {
  if (!db || !reference || !order) return { skipped: true, reason: 'missing_order' }
  const orderRef = db.collection('orders').doc(reference)
  const summary = orderSummary(order)
  const merchantLines = plainOrderLines(summary, true)
  const customerLines = plainOrderLines(summary, false)
  const merchant = validEmail(process.env.ORDER_NOTIFICATION_EMAIL) || MERCHANT_EMAIL

  const [merchantResult, customerResult] = await Promise.all([
    deliver(orderRef, 'merchant', merchant, {
      subject: `Nuevo pedido acreditado · ${summary.reference}`,
      text: ['Pago acreditado en Fenixis Store.', '', ...merchantLines].join('\n'),
      html: emailHtml('Nuevo pedido acreditado', 'Ya podés preparar esta compra.', merchantLines),
    }),
    deliver(orderRef, 'customer', summary.customer.email, {
      subject: `Confirmamos tu compra · ${summary.reference}`,
      text: ['¡Gracias por comprar en Fenixis Store!', 'Tu pago fue acreditado y recibimos el pedido.', '', ...customerLines].join('\n'),
      html: emailHtml('¡Compra confirmada!', 'Tu pago fue acreditado y ya recibimos tu pedido.', customerLines),
    }),
  ])
  return { merchant: merchantResult, customer: customerResult }
}

/**
 * Sends a one-time cancellation notice when the seller cannot fulfil an order.
 * This deliberately changes only fulfilment communication: any refund still
 * has to be coordinated by the store through the appropriate payment flow.
 */
export async function notifyOrderCancellation({ db, reference, order, reason }) {
  if (!db || !reference || !order) return { skipped: true, reason: 'missing_order' }
  const orderRef = db.collection('orders').doc(reference)
  const summary = orderSummary({ ...order, reference })
  const safeReason = cleanText(reason, 800) || 'No podemos preparar este pedido por un problema de stock.'
  const lines = [
    `Pedido: ${summary.reference}`,
    '',
    'Motivo de la cancelación:',
    safeReason,
    '',
    'Si ya realizaste un pago, te vamos a contactar para coordinar los pasos correspondientes.',
  ]
  return deliver(orderRef, 'cancellation', summary.customer.email, {
    subject: `Actualización de tu pedido · ${summary.reference}`,
    text: ['Hola, lamentamos informarte que no podremos completar tu pedido.', '', ...lines].join('\n'),
    html: emailHtml('Actualización de tu pedido', 'Lamentamos informarte que no podremos completar este pedido.', lines),
  })
}
