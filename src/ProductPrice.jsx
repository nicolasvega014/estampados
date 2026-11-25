import { normalizePaymentSettings, productPricing, transferDiscount } from './paymentSettings.js'
import './PaymentOptions.css'

const money = (value, decimals = 0) => `$ ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

export default function ProductPrice({ product, paymentSettings, benefits = true }) {
  const pricing = productPricing(product)
  const settings = normalizePaymentSettings(paymentSettings)
  const saving = transferDiscount(pricing.price, settings)
  const installments = settings.installmentsConfirmed && pricing.price >= settings.installmentMinimum ? settings.interestFreeInstallments : 0
  return <div className="product-pricing">
    <div className="product-price-line">{pricing.discountPercent > 0 && <del aria-label={`Precio anterior ${money(pricing.basePrice)}`}>{money(pricing.basePrice)}</del>}<strong>{money(pricing.price)}</strong>{pricing.discountPercent > 0 && <span className="product-discount-badge">{pricing.discountPercent}% OFF</span>}</div>
    {benefits && saving > 0 && <p className="product-transfer-price"><b>{money(pricing.price - saving)}</b> con transferencia</p>}
    {benefits && installments > 0 && <p className="product-installments">{installments} cuotas sin interés de {money(pricing.price / installments, 2)}<small>Con tarjetas habilitadas por Mercado Pago.</small></p>}
  </div>
}
