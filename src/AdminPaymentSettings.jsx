import { useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings, transferAvailable } from './paymentSettings.js'
import './DeliverySettings.css'
import './PaymentOptions.css'

export function PaymentSettingsForm({ value, onChange, onSave, saving = false, notice }) {
  const update = (key, next) => onChange({ ...value, [key]: next })
  return <form className="delivery-settings-form payment-settings-form" onSubmit={onSave}>
    <fieldset disabled={saving}><legend>Transferencias</legend>
      <label className="payment-settings-check"><input type="checkbox" checked={value.transferEnabled} onChange={(event) => update('transferEnabled', event.target.checked)} />Ofrecer pago por transferencia</label>
      <p>Al confirmar el pedido, el comprador ve estos datos y puede enviar el comprobante por WhatsApp. Verificá la acreditación en tu cuenta antes de marcarlo como pagado.</p>
      <div className="delivery-settings-prices"><label>Alias<input required maxLength={100} value={value.alias} onChange={(event) => update('alias', event.target.value)} autoCapitalize="none" /></label><label>Titular de la cuenta<input required maxLength={120} value={value.accountHolder} onChange={(event) => update('accountHolder', event.target.value)} /></label></div>
      <label>WhatsApp para comprobantes<input required type="tel" inputMode="tel" value={value.whatsappNumber} onChange={(event) => update('whatsappNumber', event.target.value)} /><small>Incluí país y característica: 549 seguido del número.</small></label>
      <label>Descuento por transferencia (%)<input required type="number" min="0" max="99" step="0.01" value={value.transferDiscountPercent} onChange={(event) => update('transferDiscountPercent', event.target.value)} /></label>
      <p>Con 0 no se ofrece descuento adicional. Se calcula sobre el precio de oferta de las prendas; no incluye el envío ni se acumula con cupones. Las unidades quedan reservadas hasta confirmar o cancelar el pedido.</p>
    </fieldset>
    <fieldset disabled={saving}><legend>Cuotas sin interés</legend>
      <p>En Mercado Pago, entrá a Costos y cuotas → Checkout → Cuotas sin interés. Elegí la cantidad y revisá el costo para la tienda antes de guardar. Esta sección solo muestra el beneficio; no activa la financiación en tu cuenta.</p>
      <div className="delivery-settings-prices"><label>Cuotas para mostrar<select value={value.interestFreeInstallments} onChange={(event) => update('interestFreeInstallments', event.target.value)}><option value="0">No mostrar</option>{[3, 6, 9, 12].map((count) => <option key={count} value={count}>{count} cuotas</option>)}</select></label><label>Monto mínimo de la promoción ($)<input required type="number" min="0" step="1" value={value.installmentMinimum} onChange={(event) => update('installmentMinimum', event.target.value)} /></label></div>
      <label className="payment-settings-check"><input type="checkbox" checked={value.installmentsConfirmed} onChange={(event) => update('installmentsConfirmed', event.target.checked)} />Confirmo que estas cuotas y el monto mínimo están activos en Mercado Pago para la tienda.</label>
      <p>Mientras no marques la confirmación, las cuotas quedan ocultas en la tienda. Se muestran en las prendas que alcanzan ese mínimo. La tarjeta y el total final determinan las opciones disponibles al pagar.</p>
    </fieldset>
    <div className="delivery-settings-save"><button disabled={saving}>{saving ? 'Guardando…' : 'Guardar opciones de pago'}</button><p>Los pedidos anteriores conservan sus datos de pago.</p></div>
    {notice && <p className={`delivery-settings-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
  </form>
}

export default function AdminPaymentSettings() {
  const [value, setValue] = useState({ ...DEFAULT_PAYMENT_SETTINGS })
  const [state, setState] = useState('loading')
  const [notice, setNotice] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getDoc(doc(db, 'settings', 'store')).then((snapshot) => {
      if (active) { setValue(normalizePaymentSettings(snapshot.data()?.payments)); setState('ready') }
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [reload])
  const save = async (event) => {
    event.preventDefault()
    if (state === 'saving') return
    const payments = normalizePaymentSettings(value)
    if ((payments.transferEnabled && !transferAvailable(payments)) || !Number.isFinite(Number(value.transferDiscountPercent)) || Number(value.transferDiscountPercent) < 0 || Number(value.transferDiscountPercent) > 99 || !Number.isSafeInteger(Number(value.installmentMinimum)) || Number(value.installmentMinimum) < 0) {
      setNotice({ error: true, message: 'Revisá el alias, titular, WhatsApp y los importes.' }); return
    }
    setState('saving'); setNotice(null)
    try {
      await setDoc(doc(db, 'settings', 'store'), { payments, updatedAt: serverTimestamp() }, { merge: true })
      setValue(payments); setNotice({ message: 'Opciones de pago actualizadas.' })
    } catch { setNotice({ error: true, message: 'No pudimos guardar los cambios. Intentá nuevamente.' }) }
    finally { setState('ready') }
  }
  return <><div className="admin-title"><h1>Pagos</h1><p>Transferencias, comprobantes y beneficios para tus clientes.</p></div>{state === 'loading' ? <p role="status">Cargando opciones de pago…</p> : state === 'error' ? <div role="alert"><p>No pudimos cargar las opciones de pago.</p><button onClick={() => { setState('loading'); setReload((n) => n + 1) }}>Reintentar</button></div> : <PaymentSettingsForm value={value} onChange={setValue} onSave={save} saving={state === 'saving'} notice={notice} />}</>
}
