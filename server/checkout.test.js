import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCart, quoteCheckout, safeOrderItems, shouldRedeemCouponUse } from './checkout.js'

const garment = { kind: 'product', productId: 'remeron-golden-girasoles', quantity: 2 }
const customGarment = { kind: 'custom', quantity: 1, size: 'M', color: 'Blanco', front: 'diseño.png' }

test('stale custom and mixed carts cannot create a quote or access coupon records', async () => {
  const db = { collection() { throw new Error('No database access expected') } }
  for (const cart of [[customGarment], [garment, customGarment]]) {
    await assert.rejects(
      quoteCheckout({ db, cart, couponCode: 'PROMO20' }),
      { code: 'CUSTOMIZATION_UNAVAILABLE', status: 409 },
    )
  }
})

test('normal catalog purchases keep their server-calculated price', async () => {
  const result = await calculateCart([{ ...garment, price: 1 }])
  assert.equal(result.subtotal, 24000)
  assert.equal(result.items[0].title, 'Remerón Golden Girasoles')
  assert.equal(result.items[0].unitPrice, 12000)
})

test('available garment variants and valid storewide coupons still work', async () => {
  const records = {
    products: { 'campera-clasica': { title: 'Campera clásica', price: 30000, sizes: ['M'], colors: [{ name: 'Azul', value: '#113355' }] } },
    coupons: { PROMO20: { code: 'PROMO20', type: 'percentage', value: 20, campaignId: 'test-campaign-01', active: true } },
  }
  const db = {
    collection(name) {
      return { doc(id) { return { get: async () => ({ id, exists: Boolean(records[name]?.[id]), data: () => records[name]?.[id] }) } } }
    },
  }
  const quote = await quoteCheckout({
    db,
    cart: [{ kind: 'product', productId: 'campera-clasica', quantity: 1, size: 'M', color: 'Azul' }],
    couponCode: 'PROMO20',
  })
  assert.deepEqual(quote.totals, { subtotal: 30000, discount: 6000, total: 24000 })
  assert.equal(quote.items[0].size, 'M')
  assert.equal(quote.items[0].color, 'Azul')
  await assert.rejects(
    calculateCart([{ kind: 'product', productId: 'campera-clasica', quantity: 1, size: 'XL', color: 'Azul' }], db),
    { code: 'PRODUCT_SIZE_UNAVAILABLE' },
  )
})

test('historical custom order details and payment settlement remain supported', () => {
  const [item] = safeOrderItems([{ ...customGarment, title: 'Remera personalizada', unitPrice: 18900, lineTotal: 18900 }])
  assert.equal(item.front, 'diseño.png')
  assert.equal(item.size, 'M')
  assert.equal(item.color, 'Blanco')
  assert.equal(shouldRedeemCouponUse({ status: 'processed', status_detail: 'accredited', items: [item] }), true)
})
