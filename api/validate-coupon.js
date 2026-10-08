import { getAdminFirestore } from '../server/firebase-admin.js'
import { CheckoutError, checkoutErrorPayload, quoteCheckout } from '../server/checkout.js'

function send(res, status, body) {
  res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { valid: false, code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' })

  try {
    const db = getAdminFirestore()
    const quote = await quoteCheckout({ db, cart: req.body?.cart, couponCode: req.body?.couponCode })
    if (quote.coupon && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      throw new CheckoutError('Los códigos promocionales todavía no están configurados para confirmar pagos pendientes.', 'COUPON_WEBHOOK_NOT_CONFIGURED', 503)
    }
    return send(res, 200, {
      valid: true,
      coupon: quote.coupon,
      totals: quote.totals,
    })
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 500
    return send(res, status, checkoutErrorPayload(error))
  }
}
