import { useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_DELIVERY_SETTINGS, normalizeDeliverySettings } from './deliverySettings.js'
import './DeliverySettings.css'

export function DeliverySettingsForm({ value, onChange, onSave, saving = false, notice = null }) {
  const update = (key, next) => onChange({ ...value, [key]: next })
  return <form className="delivery-settings-form" onSubmit={onSave}>
    <fieldset disabled={saving}>
      <legend>Retiro por el local</legend>
      <p>El retiro no tiene costo. Esta dirección se muestra antes de pagar.</p>
      <label>Dirección de retiro<input required maxLength={300} value={value.pickupAddress} onChange={(event) => update('pickupAddress', event.target.value)} /></label>
      <label>Horarios de retiro <span>(opcional)</span><input maxLength={200} value={value.pickupHours} onChange={(event) => update('pickupHours', event.target.value)} placeholder="Agregá los días y horarios de atención" /></label>
    </fieldset>
    <fieldset disabled={saving}>
      <legend>Envíos</legend>
      <p>Se suman al total de la compra. Los cupones se aplican a las prendas, sin descontar el envío.</p>
      <div className="delivery-settings-prices">
        <label>Correo Argentino a sucursal ($)<input required type="number" inputMode="numeric" min="0" step="1" value={value.branchPrice} onChange={(event) => update('branchPrice', event.target.value)} /></label>
        <label>Envío a domicilio ($)<input required type="number" inputMode="numeric" min="0" step="1" value={value.homePrice} onChange={(event) => update('homePrice', event.target.value)} /></label>
      </div>
      <label>Información para coordinar el envío<textarea required maxLength={600} rows={3} value={value.shippingInstructions} onChange={(event) => update('shippingInstructions', event.target.value)} /></label>
    </fieldset>
    <div className="delivery-settings-save"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar entrega y envíos'}</button><p>Los cambios se aplican a las nuevas compras.</p></div>
    {notice && <p className={`delivery-settings-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
  </form>
}

export default function DeliverySettings() {
  const [value, setValue] = useState({ ...DEFAULT_DELIVERY_SETTINGS })
  const [state, setState] = useState('loading')
  const [notice, setNotice] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getDoc(doc(db, 'settings', 'store')).then((snapshot) => {
      if (active) { setValue(normalizeDeliverySettings(snapshot.data()?.delivery)); setState('ready') }
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [reload])

  const save = async (event) => {
    event.preventDefault()
    if (state === 'saving') return
    if (!value.pickupAddress.trim() || !value.shippingInstructions.trim() || [value.branchPrice, value.homePrice].some((amount) => amount === '' || !Number.isSafeInteger(Number(amount)) || Number(amount) < 0)) {
      setNotice({ error: true, message: 'Completá la dirección, las indicaciones y los precios de envío en pesos, sin centavos.' })
      return
    }
    setState('saving'); setNotice(null)
    try {
      const delivery = normalizeDeliverySettings(value)
      await setDoc(doc(db, 'settings', 'store'), { delivery, updatedAt: serverTimestamp() }, { merge: true })
      setValue(delivery)
      setNotice({ message: 'Entrega y envíos actualizados.' })
    } catch {
      setNotice({ error: true, message: 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.' })
    } finally { setState('ready') }
  }

  return <><div className="admin-title"><h1>Entrega y envíos</h1><p>Definí dónde se retiran las compras y cuánto cuesta enviarlas.</p></div>
    {state === 'loading' ? <p role="status">Cargando opciones de entrega…</p> : state === 'error' ? <div role="alert"><p>No pudimos cargar la configuración de entrega.</p><button onClick={() => { setState('loading'); setReload((current) => current + 1) }}>Reintentar</button></div> : <DeliverySettingsForm value={value} onChange={(next) => { setValue(next); setNotice(null) }} onSave={save} saving={state === 'saving'} notice={notice} />}
  </>
}
