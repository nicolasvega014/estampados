import { randomUUID } from 'node:crypto'

const CUSTOM_SHIRT_PRICE = 18900
const CATALOG = {
  'remeron-yorkie-bandana': { title: 'Remerón Yorkie Bandana', price: 15000 },
  'remeron-golden-girasoles': { title: 'Remerón Golden Girasoles', price: 15000 },
  'remeron-gato-limon': { title: 'Remerón Gato Limón', price: 15000 },
  'remeron-perro-cafe': { title: 'Remerón Perro Café', price: 15000 },
  'remeron-salchicha-retro': { title: 'Remerón Salchicha Retro', price: 15000 },
  'remeron-a-ganar-lo-que-debo': { title: 'Remerón A Ganar Lo Que Debo', price: 15000 },
  'remeron-snoopy-bakery': { title: 'Remerón Snoopy Bakery', price: 15000 },
  'remeron-pug-cool': { title: 'Remerón Pug Cool', price: 15000 },
  'remeron-la-dolce-vita': { title: 'Remerón La Dolce Vita', price: 15000 },
}

function send(res, status, body) {
  res.status(status).json(body)
}

function cartTotal(cart) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 20) throw new Error('La bolsa no es válida.')

  return cart.reduce((result, item) => {
    const quantity = Number(item?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('La cantidad elegida no es válida.')

    if (item.kind === 'custom') {
      result.total += CUSTOM_SHIRT_PRICE * quantity
      result.items.push(`Remera personalizada × ${quantity}`)
      return result
    }

    const product = CATALOG[item?.productId]
    if (!product) throw new Error('Uno de los productos cambió. Quitalo de la bolsa y volvé a agregarlo para pagar.')
    result.total += product.price * quantity
    result.items.push(`${product.title} × ${quantity}`)
    return result
  }, { total: 0, items: [] })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método no permitido.' })

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) return send(res, 503, { message: 'El checkout no está configurado todavía.' })

  try {
    const { cart, payment } = req.body || {}
    const { total } = cartTotal(cart)
    const payerEmail = String(payment?.payer?.email || '').trim()
    const paymentMethodId = String(payment?.paymentMethodId || '').trim()
    const paymentType = String(payment?.paymentType || '').trim()
    const token = String(payment?.token || '').trim()
    const installments = Number(payment?.installments)

    if (!payerEmail || !paymentMethodId || !paymentType || !token || !Number.isInteger(installments) || installments < 1) {
      return send(res, 400, { message: 'Faltan datos necesarios para procesar el pago.' })
    }

    const externalReference = `fenixis-${Date.now()}-${randomUUID().slice(0, 8)}`
    const payer = { email: payerEmail }
    if (payment?.payer?.identification?.type && payment?.payer?.identification?.number) {
      payer.identification = {
        type: String(payment.payer.identification.type),
        number: String(payment.payer.identification.number),
      }
    }

    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'automatic',
        total_amount: total.toFixed(2),
        external_reference: externalReference,
        payer,
        transactions: {
          payments: [{
            amount: total.toFixed(2),
            payment_method: {
              id: paymentMethodId,
              type: paymentType,
              token,
              installments,
            },
          }],
        },
      }),
    })

    const order = await response.json().catch(() => ({}))
    if (!response.ok) {
      return send(res, response.status, { message: order?.message || 'Mercado Pago no pudo procesar el pago.' })
    }

    const transaction = order?.transactions?.payments?.[0] || {}
    return send(res, 200, {
      id: order.id,
      reference: externalReference,
      status: order.status || transaction.status,
      statusDetail: order.status_detail || transaction.status_detail,
    })
  } catch (error) {
    return send(res, 400, { message: error?.message || 'No pudimos procesar la compra.' })
  }
}
