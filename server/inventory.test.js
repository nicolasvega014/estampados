import assert from 'node:assert/strict'
import test from 'node:test'
import { reserveInventory, settleInventory, claimPaymentSubmission, reconcileInventoryReservation } from './inventory.js'
import { calculateCart } from './checkout.js'
import { availableStock, mergeInventoryEdit } from '../src/productInventory.js'
import { productImages } from '../src/productOptions.js'

const dress = () => ({ title: 'Vestido de prueba', price: 24000, sizes: ['2', '4'], colors: [{ name: 'Beige' }, { name: 'Blanco' }], trackStock: true, variants: [
  { size: '2', color: 'Beige', stock: 2, reserved: 0 }, { size: '2', color: 'Blanco', stock: 0, reserved: 0 },
  { size: '4', color: 'Beige', stock: 0, reserved: 0 }, { size: '4', color: 'Blanco', stock: 1, reserved: 0 },
] })
const line = (changes = {}) => ({ kind: 'product', productId: 'vestido-prueba', size: '4', color: 'Blanco', quantity: 1, unitPrice: 24000, ...changes })

// Atomic in-memory store: serializes transactions, rolls back failed writes,
// and rejects reads after writes just as the Firestore transaction API does.
function database(product = dress()) {
  const records = new Map([['products/vestido-prueba', product]])
  const snapshot = (ref) => ({ ref, id: ref.id, exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) })
  let queue = Promise.resolve()
  return {
    records,
    collection(name) { return { doc(id) { const ref = { id, path: `${name}/${id}` }; ref.get = async () => snapshot(ref); return ref } } },
    runTransaction(callback) {
      const promise = queue.then(async () => {
        const writes = []
        const result = await callback({
          get: async (ref) => { assert.equal(writes.length, 0, 'transaction reads must precede writes'); return snapshot(ref) },
          create: (ref, data) => { assert.ok(!records.has(ref.path)); writes.push([ref.path, data]) },
          update: (ref, data) => { assert.ok(records.has(ref.path)); writes.push([ref.path, { ...records.get(ref.path), ...data }]) },
        })
        for (const [path, data] of writes) records.set(path, data)
        return result
      })
      queue = promise.catch(() => {})
      return promise
    },
  }
}

test('unavailable size/color pairs and split duplicate lines cannot bypass stock', async () => {
  const db = database()
  await assert.rejects(calculateCart([line({ size: '2' })], db), { code: 'STOCK_UNAVAILABLE' })
  await assert.rejects(calculateCart([line(), line()], db), { code: 'STOCK_UNAVAILABLE' })
  const quote = await calculateCart([line({ size: '2', color: 'Beige', quantity: 2 })], db)
  assert.equal(quote.subtotal, 48000)
})

test('two simultaneous checkouts cannot reserve the same last unit', async () => {
  const db = database()
  const results = await Promise.allSettled(['first', 'second'].map((reference) => reserveInventory({ db, reference, items: [line()] })))
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'STOCK_UNAVAILABLE')
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '4', 'Blanco'), 0)
})

test('retry and duplicate approval notifications decrement inventory exactly once', async () => {
  const db = database()
  await reserveInventory({ db, reference: 'paid', items: [line()] })
  await reserveInventory({ db, reference: 'paid', items: [line()] })
  await Promise.all([settleInventory({ db, reference: 'paid', paid: true }), settleInventory({ db, reference: 'paid', paid: true })])
  const row = db.records.get('products/vestido-prueba').variants[3]
  assert.deepEqual(row, { size: '4', color: 'Blanco', stock: 0, reserved: 0 })
  assert.equal(db.records.get('inventoryReservations/paid').state, 'sold')
})

test('rejected and pre-payment failures release reservations once; pending holds remain unavailable', async () => {
  const db = database()
  await reserveInventory({ db, reference: 'rejected', items: [line()] })
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '4', 'Blanco'), 0)
  await settleInventory({ db, reference: 'rejected', paid: false })
  await settleInventory({ db, reference: 'rejected', paid: false })
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '4', 'Blanco'), 1)
  assert.equal(db.records.get('inventoryReservations/rejected').state, 'released')
})

test('a cart reservation is all or nothing and rechecks live price and visibility', async () => {
  const db = database()
  await assert.rejects(reserveInventory({ db, reference: 'bad', items: [line({ size: '2', color: 'Beige' }), line({ quantity: 2 })] }), { code: 'STOCK_UNAVAILABLE' })
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '2', 'Beige'), 2)
  assert.equal(db.records.has('inventoryReservations/bad'), false)
  await assert.rejects(reserveInventory({ db, reference: 'price', items: [line({ unitPrice: 1 })] }), { code: 'PRODUCT_CHANGED' })
  db.records.get('products/vestido-prueba').hidden = true
  await assert.rejects(reserveInventory({ db, reference: 'hidden', items: [line()] }), { code: 'PRODUCT_UNAVAILABLE' })
})

test('legacy products keep working without invented quantities; old orders do not change stock', async () => {
  const product = { ...dress(), trackStock: false }
  const db = database(product)
  assert.equal(await reserveInventory({ db, reference: 'legacy', items: [line({ quantity: 8 })] }), false)
  await settleInventory({ db, reference: 'historical', paid: true })
  assert.deepEqual(db.records.get('products/vestido-prueba'), product)
})

test('seller edits preserve concurrent sales and cannot erase payment holds', () => {
  const original = dress()
  const live = dress(); live.variants[0].stock = 1; live.variants[3].reserved = 1
  const merged = mergeInventoryEdit({ ...original, title: 'Nuevo nombre' }, original, live)
  assert.equal(merged[0].stock, 1)
  assert.equal(merged[3].reserved, 1)
  const draft = dress(); draft.variants[0].stock = 10
  assert.throws(() => mergeInventoryEdit(draft, original, live), /stock cambió/)
  assert.throws(() => mergeInventoryEdit({ ...original, trackStock: false }, original, live), /reservadas/)
  assert.throws(() => mergeInventoryEdit({ ...original, sizes: ['2'] }, original, live), /reservadas/)
})

test('gallery supports old single images, explicit removal, ordering and duplicates', () => {
  assert.equal(productImages({ imageUrl: '/products/old.png' }).length, 1)
  assert.equal(productImages({ images: [], imageUrl: '/products/old.png' }).length, 0)
  assert.deepEqual(productImages({ images: [{ imageUrl: '/second.png', color: 'Blanco' }, { imageUrl: '/first.png' }, { imageUrl: '/first.png' }, { imageUrl: 'javascript:bad' }] }).map((image) => image.imageUrl), ['/second.png', '/first.png'])
})

test('abandoned attempts before submission release stock and cannot later submit payment', async () => {
  const db = database()
  db.records.set('checkoutAttempts/abandoned', { state: 'created', createdAt: new Date(1000) })
  await reserveInventory({ db, items: [line()], reference: 'abandoned-order', attemptId: 'abandoned' })
  await reconcileInventoryReservation({ db, reservation: db.records.get('inventoryReservations/abandoned-order'), now: 1000 + 16 * 60 * 1000 })
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '4', 'Blanco'), 1)
  await assert.rejects(claimPaymentSubmission(db, 'abandoned'), { code: 'CHECKOUT_CAN_RETRY' })
})

test('uncertain submitted payments retain stock even after the abandoned-checkout timeout', async () => {
  const db = database()
  db.records.set('checkoutAttempts/unknown', { state: 'created', createdAt: new Date(1000) })
  await reserveInventory({ db, items: [line()], reference: 'unknown-order', attemptId: 'unknown' })
  await claimPaymentSubmission(db, 'unknown')
  await reconcileInventoryReservation({ db, reservation: db.records.get('inventoryReservations/unknown-order'), now: 1000 + 24 * 60 * 60 * 1000 })
  assert.equal(availableStock(db.records.get('products/vestido-prueba'), '4', 'Blanco'), 0)
  assert.equal(db.records.get('inventoryReservations/unknown-order').state, 'reserved')
})

test('recovery settles a known final order after an interrupted stock update', async () => {
  const db = database()
  await reserveInventory({ db, items: [line()], reference: 'completed' })
  db.records.set('orders/completed', { status: 'processed', statusDetail: 'accredited' })
  await reconcileInventoryReservation({ db, reservation: db.records.get('inventoryReservations/completed') })
  assert.equal(db.records.get('products/vestido-prueba').variants[3].stock, 0)
  assert.equal(db.records.get('inventoryReservations/completed').state, 'sold')
})
