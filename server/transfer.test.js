import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createTransferOrder, confirmTransferOrder, cancelTransferOrder, reconcileTransferOrder } from './transfer.js'
import { calculateCart } from './checkout.js'
import { reserveInventory } from './inventory.js'
import { deliveryDetails } from '../src/deliverySettings.js'
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings, productPricing } from '../src/paymentSettings.js'

function database(overrides = {}) {
  const records = new Map(Object.entries({
    'products/vestido': { title: 'Vestido', price: 10000, discountPercent: 20, sizes: ['2'], colors: [{ name: 'Azul' }], trackStock: true, variants: [{ size: '2', color: 'Azul', stock: 3, reserved: 0 }] },
    'settings/store': { payments: { ...DEFAULT_PAYMENT_SETTINGS, transferDiscountPercent: 10 } },
    ...overrides,
  }))
  let queue = Promise.resolve()
  const transformed = (value, previous) => {
    if (value?.constructor?.name === 'ServerTimestampTransform') return new Date()
    if (value?.constructor?.name === 'NumericIncrementTransform') return Number(previous || 0) + value.operand
    if (value instanceof Date) return value
    if (Array.isArray(value)) return value.map((entry) => transformed(entry))
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, transformed(entry, previous?.[key])]))
    return value
  }
  const apply = (ref, data, merge) => {
    const result = merge ? structuredClone(records.get(ref.path) || {}) : {}
    for (const [key, value] of Object.entries(data)) {
      const parts = key.split('.'); let parent = result
      while (parts.length > 1) { const part = parts.shift(); parent = parent[part] ||= {} }
      parent[parts[0]] = transformed(value, parent[parts[0]])
    }
    records.set(ref.path, result)
  }
  const snapshot = (ref) => ({ ref, id: ref.id, exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) })
  const db = {
    records,
    collection(name) {
      const makeRef = (id) => { const ref = { id, path: `${name}/${id}`, firestore: db }; ref.get = async () => snapshot(ref); ref.set = async (data, options) => apply(ref, data, options?.merge); ref.update = async (data) => apply(ref, data, true); return ref }
      const query = (filters = [], max = Infinity) => ({
        doc: makeRef,
        where: (key, op, value) => { assert.equal(op, '=='); return query([...filters, [key, value]], max) },
        limit: (count) => query(filters, count),
        get: async () => { const docs = [...records.keys()].filter((key) => key.startsWith(name + '/') && filters.every(([field, value]) => records.get(key)[field] === value)).slice(0, max).map((key) => snapshot(makeRef(key.slice(name.length + 1)))); return { docs, size: docs.length } },
      })
      return query()
    },
    runTransaction(callback) {
      const task = queue.then(async () => {
        const writes = []
        const result = await callback({
          get: async (ref) => { assert.equal(writes.length, 0, 'all reads must precede writes'); return snapshot(ref) },
          create: (ref, data) => { assert.ok(!records.has(ref.path)); writes.push([ref, data, false]) },
          update: (ref, data) => { assert.ok(records.has(ref.path)); writes.push([ref, data, true]) },
          set: (ref, data, options) => writes.push([ref, data, options?.merge]),
        })
        for (const args of writes) apply(...args)
        return result
      })
      queue = task.catch(() => {})
      return task
    },
  }
  return db
}

function body(changes = {}) {
  return { checkoutAttemptId: randomUUID(), cart: [{ kind: 'product', productId: 'vestido', quantity: 1, size: '2', color: 'Azul', price: 1 }], customer: { name: 'Prueba', email: 'buyer@example.com', phone: '1112345678', delivery: 'Correo Argentino a sucursal' }, couponCode: '', deliveryQuote: deliveryDetails('Correo Argentino a sucursal'), expectedTotal: 14700, expectedTransferDiscountPercent: 10, ...changes }
}
const row = (db) => db.records.get('products/vestido').variants[0]
const coupon = { code: 'PROMO20', type: 'percentage', value: 20, campaignId: 'test-transfer-campaign', active: true, maxUses: 1, perCustomerLimit: 1, usageCount: 0, reservedUses: 0 }

test('sale price is authoritative, transfer discount excludes delivery, and bank data is snapshotted', async () => {
  const db = database()
  assert.equal(productPricing({ price: 10000, discountPercent: 20 }).price, 8000)
  const quote = await calculateCart(body().cart, db)
  assert.equal(quote.subtotal, 8000)
  await assert.rejects(reserveInventory({ db, items: [{ ...quote.items[0], unitPrice: 1 }], reference: 'tamper' }), { code: 'PRODUCT_CHANGED' })
  const result = await createTransferOrder({ db, body: body({ alias: 'attacker', transferDiscount: 8000 }) })
  assert.equal(result.total, 14700)
  assert.equal(result.transferDiscount, 800)
  assert.equal(result.shippingTotal, 7500)
  assert.equal(result.transferDetails.alias, 'fenixis')
  assert.equal(result.transferDetails.accountHolder, 'Maximiliano Hinojosa')
  assert.equal(result.status, 'awaiting_transfer')
  assert.equal(row(db).stock, 3); assert.equal(row(db).reserved, 1)
})

test('duplicate and simultaneous submissions reuse one order and reject changing its body', async () => {
  const db = database(); const request = body()
  const results = await Promise.allSettled([createTransferOrder({ db, body: request }), createTransferOrder({ db, body: request })])
  assert.ok(results.some((result) => result.status === 'fulfilled'))
  const retry = await createTransferOrder({ db, body: request })
  assert.equal([...db.records.keys()].filter((key) => key.startsWith('orders/')).length, 1)
  assert.equal(row(db).reserved, 1)
  assert.equal(retry.status, 'awaiting_transfer')
  await assert.rejects(createTransferOrder({ db, body: { ...request, expectedTotal: 1 } }), { code: 'TRANSFER_ATTEMPT_CHANGED' })
})

test('changed shipping/total/discount, invalid contact and disabled transfers cannot reserve stock', async () => {
  for (const [change, code] of [
    [{ expectedTotal: 1 }, 'CHECKOUT_TOTAL_CHANGED'],
    [{ deliveryQuote: { ...body().deliveryQuote, cost: 1 } }, 'DELIVERY_CHANGED'],
    [{ expectedTransferDiscountPercent: 99 }, 'TRANSFER_CHANGED'],
    [{ customer: { ...body().customer, phone: '' } }, 'CUSTOMER_PHONE'],
    [{ customer: { ...body().customer, email: 'bad' } }, 'CUSTOMER_EMAIL'],
  ]) {
    const db = database(); await assert.rejects(createTransferOrder({ db, body: body(change) }), { code }); assert.equal(row(db).reserved, 0)
  }
  const db = database({ 'settings/store': { payments: { transferEnabled: false } } })
  await assert.rejects(createTransferOrder({ db, body: body() }), { code: 'TRANSFER_DISABLED' })
})

test('pending transfers stay reserved until verified; duplicate confirmations sell once', async () => {
  const db = database(); const result = await createTransferOrder({ db, body: body() })
  await reconcileTransferOrder({ db, reference: result.reference, now: Date.now() + 10 * 86400000 })
  assert.equal(row(db).reserved, 1)
  await Promise.all([1, 2].map(() => confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'verified-admin' })))
  assert.equal(row(db).stock, 2); assert.equal(row(db).reserved, 0)
  assert.equal(db.records.get('orders/' + result.reference).transferConfirmedBy, 'verified-admin')
})

test('cancellation frees a pending hold once and prevents later confirmation', async () => {
  const db = database(); const result = await createTransferOrder({ db, body: body() })
  await cancelTransferOrder({ db, reference: result.reference, reason: 'No se recibió el pago.' })
  await cancelTransferOrder({ db, reference: result.reference, reason: 'No se recibió el pago.' })
  await assert.rejects(confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'admin' }), { code: 'TRANSFER_CLOSED' })
  assert.equal(row(db).stock, 3); assert.equal(row(db).reserved, 0)
})

test('confirm/cancel races preserve the terminal money state and do not restock a paid order', async () => {
  const db = database(); const result = await createTransferOrder({ db, body: body() })
  await Promise.allSettled([confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'admin' }), cancelTransferOrder({ db, reference: result.reference, reason: 'Sin stock.' })])
  await reconcileTransferOrder({ db, reference: result.reference })
  const saved = db.records.get('orders/' + result.reference)
  assert.equal(row(db).stock, saved.status === 'approved' ? 2 : 3); assert.equal(row(db).reserved, 0)
})

test('coupon limits are held, redeemed once, or released; extra transfer discounts cannot stack', async () => {
  const store = { payments: { ...DEFAULT_PAYMENT_SETTINGS, transferDiscountPercent: 0 } }
  const db = database({ 'settings/store': store, 'coupons/PROMO20': coupon })
  const request = body({ couponCode: 'PROMO20', expectedTransferDiscountPercent: 0, expectedTotal: 13900 })
  const result = await createTransferOrder({ db, body: request })
  assert.equal(db.records.get('coupons/PROMO20').reservedUses, 1)
  await assert.rejects(createTransferOrder({ db, body: { ...request, checkoutAttemptId: randomUUID() } }), { code: 'COUPON_LIMIT_REACHED' })
  await confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'admin' })
  await reconcileTransferOrder({ db, reference: result.reference })
  assert.equal(db.records.get('coupons/PROMO20').usageCount, 1)
  assert.equal(db.records.get('coupons/PROMO20').reservedUses, 0)
  const other = database({ 'settings/store': store, 'coupons/PROMO20': coupon })
  const pending = await createTransferOrder({ db: other, body: request })
  await cancelTransferOrder({ db: other, reference: pending.reference, reason: 'Cancelado por el cliente.' })
  assert.equal(other.records.get('coupons/PROMO20').usageCount, 0); assert.equal(other.records.get('coupons/PROMO20').reservedUses, 0)
  const conflict = database({ 'coupons/PROMO20': coupon })
  await assert.rejects(createTransferOrder({ db: conflict, body: body({ couponCode: 'PROMO20' }) }), { code: 'TRANSFER_COUPON_CONFLICT' })
})

test('later alias/price changes do not rewrite previous payment instructions', async () => {
  const db = database(); const request = body(); const result = await createTransferOrder({ db, body: request })
  db.records.set('settings/store', { payments: { ...DEFAULT_PAYMENT_SETTINGS, alias: 'new.alias', accountHolder: 'New holder', transferDiscountPercent: 30 } })
  const retry = await createTransferOrder({ db, body: request })
  assert.deepEqual(retry, result)
})

test('two customers cannot reserve the last unit, even if price and coupon validation ran together', async () => {
  const db = database(); row(db).stock = 1
  const results = await Promise.allSettled([createTransferOrder({ db, body: body() }), createTransferOrder({ db, body: body() })])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(row(db).reserved, 1)
  assert.equal([...db.records.values()].filter((record) => record.paymentMethod === 'transfer' && record.status === 'awaiting_transfer').length, 1)
})

test('interrupted creation is recovered; a late reservation cannot reopen a failed order', async () => {
  const db = database(); const quote = await calculateCart(body().cart, db)
  const reference = 'interrupted-transfer'; const ref = db.collection('orders').doc(reference)
  db.records.set(ref.path, { reference, paymentMethod: 'transfer', status: 'creating_transfer', transferCreatedAt: Date.now() - 3600000 })
  await reserveInventory({ db, items: quote.items, reference, transferOrderRef: ref })
  await reconcileTransferOrder({ db, reference })
  assert.equal(row(db).reserved, 0); assert.equal(db.records.get(ref.path).status, 'failed')
  await assert.rejects(reserveInventory({ db, items: quote.items, reference, transferOrderRef: ref }), { code: 'TRANSFER_CLOSED' })
})

test('pending and confirmed messages are distinct, include bank/delivery data, and are idempotent', async (t) => {
  const before = { key: process.env.RESEND_API_KEY, from: process.env.ORDER_EMAIL_FROM }
  process.env.RESEND_API_KEY = 'mock'; process.env.ORDER_EMAIL_FROM = 'test@example.com'
  t.after(() => { if (before.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = before.key; if (before.from === undefined) delete process.env.ORDER_EMAIL_FROM; else process.env.ORDER_EMAIL_FROM = before.from })
  const messages = []
  t.mock.method(globalThis, 'fetch', async (url, request) => { assert.equal(url, 'https://api.resend.com/emails'); messages.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: 'mock' }) } })
  const db = database(); const result = await createTransferOrder({ db, body: body() })
  assert.equal(messages.length, 2)
  const buyer = messages.find((message) => message.to.includes('buyer@example.com'))
  assert.match(buyer.text, /Alias: fenixis/); assert.match(buyer.text, /Maximiliano Hinojosa/); assert.match(buyer.text, /14\.700/); assert.match(buyer.text, /wa.me/)
  assert.match(buyer.text, /Correo Argentino/); assert.match(buyer.text, /Pago pendiente/)
  await reconcileTransferOrder({ db, reference: result.reference }); assert.equal(messages.length, 2)
  await confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'admin' })
  assert.equal(messages.length, 4)
  assert.match(messages.at(-1).text, /pago fue acreditado/)
  await confirmTransferOrder({ db, reference: result.reference, confirmedBy: 'admin' }); assert.equal(messages.length, 4)
})

test('unconfirmed installment settings and invalid discount inputs normalize safely', () => {
  assert.equal(normalizePaymentSettings().interestFreeInstallments, 3)
  assert.equal(normalizePaymentSettings().installmentsConfirmed, false)
  assert.equal(normalizePaymentSettings().transferDiscountPercent, 20)
  assert.equal(normalizePaymentSettings({ interestFreeInstallments: 6 }).installmentsConfirmed, false)
  assert.equal(productPricing({ price: 10000, discountPercent: 999 }).price, 10000)
})
