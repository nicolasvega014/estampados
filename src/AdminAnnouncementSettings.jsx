import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { automaticAnnouncementMessages, MAX_ANNOUNCEMENT_LENGTH, MAX_ANNOUNCEMENT_MESSAGES, normalizeAnnouncementSettings, validateAnnouncementSettings } from './announcementSettings.js'
import './DeliverySettings.css'
import './AdminAnnouncementSettings.css'

export function AnnouncementSettingsForm({ value, paymentSettings, onChange, onSave, saving = false, notice }) {
  const automatic = value.mode === 'automatic'
  const messages = automatic ? automaticAnnouncementMessages(paymentSettings) : value.messages
  const preview = messages.map((message) => message.trim()).filter(Boolean)
  const fields = useRef(null)
  const focusAfterChange = useRef(null)
  useEffect(() => {
    if (focusAfterChange.current === null) return
    fields.current?.querySelectorAll('textarea')[focusAfterChange.current]?.focus()
    focusAfterChange.current = null
  }, [messages.length])
  const updateMessages = (next) => onChange({ ...value, mode: 'custom', messages: next })
  return <form className="delivery-settings-form announcement-settings" onSubmit={onSave}>
    <fieldset disabled={saving}>
      <legend>Los avisos de tu tienda</legend>
      <p>Editá los mensajes que se desplazan arriba del logo, en el inicio y en Todas las prendas.</p>
      <label className="announcement-visibility"><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />Mostrar la franja en la tienda</label>
      <div className="announcement-preview" aria-label="Vista previa de la franja">
        <div className="announcement-preview-heading"><span>Vista previa</span><small>{value.enabled ? 'Visible en la tienda' : 'Oculta en la tienda'}</small></div>
        <div className={`announcement-preview-strip${value.enabled ? '' : ' is-hidden'}`}>
          {preview.length ? preview.map((message, index) => <span key={index}>{message}</span>) : <span>Escribí un mensaje para ver cómo queda.</span>}
        </div>
        <p>{value.enabled ? 'En la tienda, los mensajes se muestran con la animación de la franja.' : 'Los textos quedan guardados aunque la franja esté oculta.'}</p>
      </div>
      <div className="announcement-messages-heading"><h2>Mensajes</h2><span>{messages.length} de {MAX_ANNOUNCEMENT_MESSAGES}</span></div>
      <div ref={fields} className="announcement-messages">
        {messages.map((message, index) => <div className="announcement-message" key={index}>
          <label htmlFor={`announcement-message-${index}`}>Mensaje {index + 1}</label>
          <button type="button" className="announcement-remove" disabled={messages.length === 1} aria-label={`Quitar mensaje ${index + 1}`} onClick={() => { focusAfterChange.current = Math.min(index, messages.length - 2); updateMessages(messages.filter((_, itemIndex) => itemIndex !== index)) }}>Quitar <span aria-hidden="true">×</span></button>
          <textarea id={`announcement-message-${index}`} required rows="2" maxLength={MAX_ANNOUNCEMENT_LENGTH} value={message} aria-describedby={`announcement-count-${index}`} onChange={(event) => updateMessages(messages.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} />
          <small id={`announcement-count-${index}`}>{message.length}/{MAX_ANNOUNCEMENT_LENGTH} caracteres</small>
        </div>)}
      </div>
      <div className="announcement-actions">
        <button type="button" disabled={messages.length >= MAX_ANNOUNCEMENT_MESSAGES} onClick={() => { focusAfterChange.current = messages.length; updateMessages([...messages, '']) }}>Agregar mensaje <span aria-hidden="true">+</span></button>
        {!automatic && <button type="button" className="announcement-restore" onClick={() => onChange({ ...value, mode: 'automatic', messages: [] })}>Usar textos automáticos</button>}
      </div>
      <p className="announcement-help">{automatic ? 'Los textos automáticos toman el descuento vigente de Pagos. Podés escribir encima para personalizarlos.' : 'Los textos personalizados se muestran tal como los escribís.'} Editar un aviso no modifica precios, descuentos ni envíos.</p>
    </fieldset>
    <div className="delivery-settings-save"><button disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button><p>Los cambios se publican al guardar.</p></div>
    {notice && <p className={`delivery-settings-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
  </form>
}

export default function AdminAnnouncementSettings() {
  const [value, setValue] = useState(() => normalizeAnnouncementSettings())
  const [paymentSettings, setPaymentSettings] = useState({ transferEnabled: false })
  const [state, setState] = useState('loading')
  const [notice, setNotice] = useState(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getDoc(doc(db, 'settings', 'store')).then((snapshot) => {
      if (!active) return
      setValue(normalizeAnnouncementSettings(snapshot.data()?.announcement))
      setPaymentSettings(snapshot.data()?.payments)
      setState('ready')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [reload])
  const save = async (event) => {
    event.preventDefault()
    if (state === 'saving') return
    const error = validateAnnouncementSettings(value)
    if (error) { setNotice({ error: true, message: error }); return }
    const announcement = normalizeAnnouncementSettings(value)
    setState('saving'); setNotice(null)
    try {
      await setDoc(doc(db, 'settings', 'store'), { announcement, updatedAt: serverTimestamp() }, { merge: true })
      setValue(announcement)
      setNotice({ message: announcement.enabled ? 'Franja superior actualizada en el inicio y en Todas las prendas.' : 'Franja oculta en la tienda. Los mensajes quedaron guardados.' })
    } catch { setNotice({ error: true, message: 'No pudimos guardar la franja. Tus cambios siguen acá; volvé a intentar.' }) }
    finally { setState('ready') }
  }
  return <><div className="admin-title"><h1>Franja superior</h1><p>Promociones y novedades, con tus propias palabras.</p></div>
    {state === 'loading' ? <p role="status">Cargando los avisos…</p> : state === 'error' ? <div role="alert"><p>No pudimos cargar la franja superior.</p><button onClick={() => { setState('loading'); setReload((current) => current + 1) }}>Reintentar</button></div> : <AnnouncementSettingsForm value={value} paymentSettings={paymentSettings} onChange={(next) => { setValue(next); setNotice(null) }} onSave={save} saving={state === 'saving'} notice={notice} />}
  </>
}
