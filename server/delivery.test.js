import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteCheckout, safeCustomer } from './checkout.js'
import { quoteDelivery } from './delivery.js'
import { deliveryDetails } from '../src/deliverySettings.js'
import { notifyPaidOrder } from './order-email.js'

function database(delivery) {
  const records = {
    settings: { store: { delivery } },
    products: { vestido: { title: 'Vestido', price: 24000 } },
    coupons: { PROMO20: { code: 'PROMO20', type: 'percentage', value: 20, campaignId: 'test-delivery-campaign', active: true } },
  }
  return { collection(name) { return { doc(id) { return { get: async () => ({ id, exists: !!records[name]?.[id], data: () => records[name]?.[id] }) } } } } }
}
const cart = [{ kind: 'product', productId: 'vestido', quantity: 1 }]

test('pickup is free and both shipping rates are added after the garment discount', async () => {
  const db = database()
  for (const couponCode of ['', 'PROMO20']) {
    const garments = await quoteCheckout({ db, cart, couponCode })
    for (const [selection, cost] of [['Retiro por el local', 0], ['Correo Argentino a sucursal', 7500], ['Envío a domicilio', 11500]]) {
      const expectedDelivery = deliveryDetails(selection)
      const result = await quoteDelivery({ db, quote: garments, customer: { delivery: selection }, expectedDelivery, expectedTotal: garments.totals.total + cost })
      assert.equal(result.totals.shipping, cost)
      assert.equal(result.totals.discount, couponCode ? 4800 : 0)
      assert.equal(result.totals.total, (couponCode ? 19200 : 24000) + cost)
      assert.equal(result.delivery.mode === 'pickup' ? result.delivery.pickupAddress : result.delivery.instructions, cost ? 'Coordinamos el envío después de la compra.' : 'Bogotá 5191, Ezpeleta')
    }
  }
})

test('shipping prices and the payable total cannot be supplied or reduced by the buyer', async () => {
  const db = database(), quote = await quoteCheckout({ db, cart })
  const customer = { delivery: 'Envío a domicilio', shippingTotal: 1 }
  const expectedDelivery = deliveryDetails(customer.delivery)
  await assert.rejects(quoteDelivery({ db, quote, customer, expectedDelivery: { ...expectedDelivery, cost: 1 }, expectedTotal: 24001 }), { code: 'DELIVERY_CHANGED' })
  await assert.rejects(quoteDelivery({ db, quote, customer, expectedDelivery, expectedTotal: 24000 }), { code: 'CHECKOUT_TOTAL_CHANGED' })
  await assert.rejects(quoteDelivery({ db, quote, customer: { delivery: 'Gratis' }, expectedTotal: 24000 }), { code: 'DELIVERY_INVALID' })
  await assert.rejects(quoteDelivery({ db, quote, customer }), { code: 'DELIVERY_CHANGED' })
})

test('saved settings apply to new quotes; old displayed prices or addresses require buyer review', async () => {
  const settings = { homePrice: 12000, pickupAddress: 'Dirección de prueba', pickupHours: 'Horario de prueba' }
  const db = database(settings), quote = await quoteCheckout({ db, cart })
  for (const selection of ['Envío a domicilio', 'Retiro por el local']) {
    const customer = { delivery: selection }, expectedDelivery = deliveryDetails(selection, settings)
    const result = await quoteDelivery({ db, quote, customer, expectedDelivery, expectedTotal: quote.totals.total + expectedDelivery.cost })
    assert.deepEqual(result.delivery, expectedDelivery)
    await assert.rejects(quoteDelivery({ db, quote, customer, expectedDelivery: deliveryDetails(selection), expectedTotal: quote.totals.total + expectedDelivery.cost }), { code: 'DELIVERY_CHANGED' })
  }
  assert.equal(safeCustomer({ delivery: 'Envío a domicilio', address: '' }, 'test@example.com').address, '')
})

test('a settings read failure cannot proceed with an invented or stale shipping charge', async () => {
  const db = { collection() { throw new Error('offline') } }
  await assert.rejects(quoteDelivery({ db, quote: { totals: { total: 24000 } }, customer: { delivery: 'Envío a domicilio' } }), { code: 'DELIVERY_UNAVAILABLE', status: 503 })
})

test('merchant and customer confirmations include delivery details and the charged shipping, without sending mail', async (t) => {
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.ORDER_EMAIL_FROM
  process.env.RESEND_API_KEY = 'local-fixture'
  process.env.ORDER_EMAIL_FROM = 'test@example.com'
  t.after(() => {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey
    if (oldFrom === undefined) delete process.env.ORDER_EMAIL_FROM; else process.env.ORDER_EMAIL_FROM = oldFrom
  })
  const messages = []
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url, 'https://api.resend.com/emails')
    messages.push(JSON.parse(request.body))
    return { ok: true, json: async () => ({ id: 'local-only' }) }
  })
  const db = { collection() { return { doc() { return { firestore: db, update: async () => {} } } } }, runTransaction: async (run) => run({ get: async () => ({ exists: true, data: () => ({}) }), update: () => {} }) }
  for (const selection of ['Retiro por el local', 'Correo Argentino a sucursal', 'Envío a domicilio']) {
    const delivery = deliveryDetails(selection)
    await notifyPaidOrder({ db, reference: 'fixture', order: { reference: 'fixture', customer: { email: 'buyer@example.com', delivery: selection }, subtotal: 24000, total: 24000 + delivery.cost, shippingTotal: delivery.cost, deliveryDetails: delivery } })
    for (const message of messages.splice(0)) {
      assert.ok(message.text.includes(selection))
      if (delivery.mode === 'pickup') assert.ok(message.text.includes('Bogotá 5191, Ezpeleta'))
      else {
        assert.ok(message.text.includes('A coordinar después de la compra'))
        assert.ok(message.text.includes(`Envío (incluido en el total): $ ${delivery.cost.toLocaleString('es-AR')}`))
      }
      assert.ok(message.text.includes(`Total: $ ${(24000 + delivery.cost).toLocaleString('es-AR')}`))
    }
  }
})
