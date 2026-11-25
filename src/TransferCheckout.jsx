import { useRef, useState } from 'react'
import { transferDiscount, transferWhatsappUrl } from './paymentSettings.js'
import './PaymentOptions.css'

const money = (amount) => `$ ${Number(amount).toLocaleString('es-AR')}`

export function TransferReceipt({ order, onComplete }) {
  const [copyMessage, setCopyMessage] = useState('')
  const copyAlias = async () => {
    try { await navigator.clipboard.writeText(order.transferDetails.alias); setCopyMessage('Alias copiado.') }
    catch { setCopyMessage('Seleccioná el alias que aparece arriba para copiarlo.') }
  }
  return <section className="transfer-checkout">
    <h3>{order.status === 'approved' ? 'Pago confirmado' : 'Tu pedido está reservado'}</h3>
    <p>{order.status === 'approved' ? 'Ya verificamos tu transferencia.' : 'Falta realizar la transferencia. Verificaremos la acreditación para confirmar tu compra.'}</p>
    <p><strong>Pedido:</strong> {order.reference}</p>
    <div className="transfer-instructions"><dl><div><dt>Importe exacto a transferir</dt><dd>{money(order.total)}</dd></div><div><dt>Alias</dt><dd>{order.transferDetails.alias}</dd><button className="transfer-copy" type="button" onClick={copyAlias}>Copiar alias</button></div><div><dt>Titular</dt><dd>{order.transferDetails.accountHolder}</dd></div></dl>{copyMessage && <p role="status">{copyMessage}</p>}</div>
    <p>Antes de transferir, comprobá que el titular coincida. Después enviá el comprobante por WhatsApp con el número de pedido.</p>
    <a className="transfer-receipt-link" href={transferWhatsappUrl(order)} target="_blank" rel="noreferrer">Enviar comprobante por WhatsApp</a>
    <p><strong>Detalle de tu compra</strong></p>
    <ul className="transfer-order-lines">{order.items.map((item, index) => <li key={index}>{item.quantity} × {item.title}{item.size ? ` · Talle ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''} — {money(item.lineTotal)}</li>)}</ul>
    {Number(order.discount) > 0 && <p>Descuento {order.coupon?.code}: − {money(order.discount)}</p>}
    {Number(order.transferDiscount) > 0 && <p>Descuento por transferencia: − {money(order.transferDiscount)}</p>}
    <p><strong>{order.deliveryDetails.label}</strong> · {order.shippingTotal ? money(order.shippingTotal) : 'Sin cargo'}<br />{order.deliveryDetails.mode === 'pickup' ? order.deliveryDetails.pickupAddress : order.deliveryDetails.instructions}</p>
    <p>Guardá estos datos para completar la transferencia. Si necesitás ayuda, escribinos por WhatsApp.</p>
    <button className="transfer-back" type="button" onClick={onComplete}>Volver a la tienda</button>
  </section>
}

export default function TransferCheckout({ items, customer, delivery, couponCode, couponTotals, paymentSettings, onCancel, onCreated }) {
  const [state, setState] = useState({ busy: false, message: '', uncertain: false })
  const attempt = useRef(crypto.randomUUID())
  const submitting = useRef(false)
  const subtotal = couponTotals?.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = couponTotals?.discount || 0
  const discount = transferDiscount(subtotal - couponDiscount, paymentSettings)
  const total = subtotal - couponDiscount - discount + delivery.cost
  const submit = async () => {
    if (submitting.current) return
    submitting.current = true
    setState({ busy: true, message: 'Reservando tus prendas…', uncertain: true })
    try {
      const response = await fetch('/api/transfer-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutAttemptId: attempt.current, cart: items.map((item) => ({ productId: item.productId, kind: item.kind, quantity: item.quantity, size: item.size || '', color: item.color || '' })), customer, couponCode: couponCode || '', deliveryQuote: delivery, expectedTotal: total, expectedTransferDiscountPercent: paymentSettings.transferDiscountPercent }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.retryable) attempt.current = crypto.randomUUID()
        setState({ busy: false, message: result.message || 'No pudimos guardar el pedido. Intentá nuevamente.', uncertain: response.status >= 500 || result.code === 'TRANSFER_IN_PROGRESS' })
        return
      }
      onCreated(result)
    } catch { setState({ busy: false, message: 'Se interrumpió la conexión. Reintentá para recuperar este pedido; no se generará uno duplicado.', uncertain: true }) }
    finally { submitting.current = false }
  }
  return <section className="transfer-checkout"><h3>Confirmá tu pedido</h3><p>Al confirmar, reservamos tus prendas y te mostramos el alias y el titular para transferir.</p>
    <div className="delivery-order-totals"><div><span>Prendas</span><strong>{money(subtotal)}</strong></div>{couponDiscount > 0 && <div><span>Cupón {couponCode}</span><strong>− {money(couponDiscount)}</strong></div>}{discount > 0 && <div><span>Descuento por transferencia</span><strong>− {money(discount)}</strong></div>}<div><span>{delivery.label}</span><strong>{delivery.cost ? money(delivery.cost) : 'Sin cargo'}</strong></div><div className="delivery-order-total"><span>Total a transferir</span><strong>{money(total)}</strong></div></div>
    <p>{delivery.mode === 'pickup' ? delivery.pickupAddress : delivery.instructions}</p>
    <button type="button" disabled={state.busy} onClick={submit}>{state.busy ? 'Guardando pedido…' : state.uncertain ? 'Reintentar el mismo pedido' : 'Confirmar pedido por transferencia'}</button>
    {state.message && <p className={state.busy ? '' : 'transfer-error'} role={state.busy ? 'status' : 'alert'}>{state.message}</p>}
    <button type="button" className="transfer-back" disabled={state.busy || state.uncertain} onClick={onCancel}>Volver al carrito</button>
  </section>
}
