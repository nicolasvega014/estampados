import { getAdminFirestore } from '../server/firebase-admin.js'
import { CheckoutError, checkoutErrorPayload } from '../server/checkout.js'
import { createTransferOrder } from '../server/transfer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido.' })
  try {
    const db = getAdminFirestore()
    if (!db) throw new CheckoutError('No pudimos conectar con la tienda. Intentá nuevamente.', 'TRANSFER_UNAVAILABLE', 503)
    const order = await createTransferOrder({ db, body: req.body || {} })
    return res.status(200).json(order)
  } catch (error) {
    return res.status(error instanceof CheckoutError ? error.status : 500).json(error instanceof CheckoutError ? { ...checkoutErrorPayload(error), retryable: error.code === 'TRANSFER_RETRY' } : { message: 'No pudimos confirmar el pedido. Reintentá con el mismo carrito para recuperar el resultado.' })
  }
}
