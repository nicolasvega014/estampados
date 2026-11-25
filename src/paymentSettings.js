export const DEFAULT_PAYMENT_SETTINGS = Object.freeze({
  transferEnabled: true,
  alias: 'fenixis',
  accountHolder: 'Maximiliano Hinojosa',
  whatsappNumber: '5491165937433',
  transferDiscountPercent: 20,
  interestFreeInstallments: 3,
  installmentMinimum: 0,
  installmentsConfirmed: false,
})

export function discountPercent(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 99 ? Math.round(number * 100) / 100 : 0
}

export function productPricing(product) {
  const amount = Number(product?.price)
  const basePrice = Number.isSafeInteger(Math.round(amount)) && amount > 0 ? Math.round(amount) : 0
  const percent = discountPercent(product?.discountPercent)
  const price = Math.max(basePrice ? 1 : 0, Math.round(basePrice * (1 - percent / 100)))
  return { basePrice, price, discountPercent: price < basePrice ? percent : 0 }
}

export function normalizePaymentSettings(value = {}) {
  const settings = { ...DEFAULT_PAYMENT_SETTINGS, ...value }
  const clean = (text, max) => String(text ?? '').trim().slice(0, max)
  const count = Number(settings.interestFreeInstallments)
  return {
    transferEnabled: settings.transferEnabled === true,
    alias: clean(settings.alias, 100),
    accountHolder: clean(settings.accountHolder, 120),
    whatsappNumber: clean(settings.whatsappNumber, 30).replace(/\D/g, ''),
    transferDiscountPercent: discountPercent(settings.transferDiscountPercent),
    interestFreeInstallments: [3, 6, 9, 12].includes(count) ? count : 0,
    installmentMinimum: Math.max(0, Math.round(Number(settings.installmentMinimum) || 0)),
    installmentsConfirmed: settings.installmentsConfirmed === true,
  }
}

export function transferAvailable(settings) {
  return settings.transferEnabled && Boolean(settings.alias && settings.accountHolder) && /^\d{10,15}$/.test(settings.whatsappNumber)
}

export function transferDiscount(amount, settings) {
  return transferAvailable(settings) ? Math.min(Math.max(0, amount - 1), Math.round(amount * settings.transferDiscountPercent / 100)) : 0
}

export function transferWhatsappUrl(order) {
  const number = String(order?.transferDetails?.whatsappNumber || '').replace(/\D/g, '')
  const message = `Hola, quiero enviar el comprobante del pedido ${order.reference}. Total: $ ${Number(order.total).toLocaleString('es-AR')}.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
