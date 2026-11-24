import { deliveryDetails } from '../src/deliverySettings.js'
import { CheckoutError } from './checkout.js'

export async function quoteDelivery({ db, quote, customer, expectedDelivery, expectedTotal }) {
  let settings
  try {
    const snapshot = await db.collection('settings').doc('store').get()
    settings = snapshot.data()?.delivery
  } catch {
    throw new CheckoutError('No pudimos verificar las opciones de entrega. Intentá nuevamente en unos minutos.', 'DELIVERY_UNAVAILABLE', 503)
  }
  const delivery = deliveryDetails(customer?.delivery, settings)
  if (!delivery) throw new CheckoutError('Elegí cómo querés recibir tu compra.', 'DELIVERY_INVALID')
  // Never trust a browser-supplied shipping price or charge a changed price
  // without first showing it to the buyer. Older tabs must refresh as well.
  if (!expectedDelivery || Object.keys(delivery).some((key) => delivery[key] !== expectedDelivery[key])) {
    throw new CheckoutError('Las opciones de entrega cambiaron. Volvé al carrito y actualizá la página para revisar el total antes de pagar.', 'DELIVERY_CHANGED', 409)
  }
  const total = quote.totals.total + delivery.cost
  if (typeof expectedTotal !== 'number' || expectedTotal !== total) {
    throw new CheckoutError('El total de tu compra cambió. Volvé al carrito y actualizá la página para revisar los precios antes de pagar.', 'CHECKOUT_TOTAL_CHANGED', 409)
  }
  return { ...quote, delivery, totals: { ...quote.totals, shipping: delivery.cost, total } }
}
