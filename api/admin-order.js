import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getAdminApp, getAdminFirestore } from '../server/firebase-admin.js'
import { notifyOrderCancellation } from '../server/order-email.js'

const FULFILLMENT_STATUSES = new Set(['en_preparacion', 'a_retirar', 'a_enviar', 'enviado', 'retirado'])
const STORE_OWNER_EMAIL = String(process.env.FENIXIS_STORE_OWNER_EMAIL || 'nicolasvega014@gmail.com').trim().toLowerCase()

function send(res, status, body) {
  res.status(status).json(body)
}

function cleanReason(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 800)
}

async function requireStoreAdmin(request) {
  const authorization = request.headers.authorization || ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!idToken) return { allowed: false, refreshAuth: false }
  const app = getAdminApp()
  if (!app) return { allowed: false, refreshAuth: false }
  const auth = getAuth(app)
  const decoded = await auth.verifyIdToken(idToken)
  if (decoded.admin === true) return { allowed: true, refreshAuth: false }

  // La cuenta del dueño existía antes de que se agregaran los permisos por
  // custom claim. Solo la identidad exacta que Firebase reconoce como dueña
  // puede reparar ese permiso una vez; nadie más puede autoasignarse acceso.
  const email = String(decoded.email || '').trim().toLowerCase()
  if (!STORE_OWNER_EMAIL || email !== STORE_OWNER_EMAIL) return { allowed: false, refreshAuth: false }
  const owner = await auth.getUser(decoded.uid)
  if (String(owner.email || '').trim().toLowerCase() !== STORE_OWNER_EMAIL || owner.disabled) return { allowed: false, refreshAuth: false }

  await auth.setCustomUserClaims(owner.uid, { ...(owner.customClaims || {}), admin: true })
  return { allowed: true, refreshAuth: true }
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return send(res, 405, { message: 'Método no permitido.' })

  try {
    const access = await requireStoreAdmin(req)
    if (!access.allowed) return send(res, 403, { message: 'Tu cuenta no tiene permiso para actualizar pedidos.' })

    const orderId = String(req.body?.orderId || '').trim()
    const action = String(req.body?.action || '').trim()
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(orderId)) return send(res, 400, { message: 'El pedido no es válido.' })

    const db = getAdminFirestore()
    if (!db) return send(res, 503, { message: 'La gestión privada de pedidos todavía no está configurada.' })
    const orderRef = db.collection('orders').doc(orderId)
    const snapshot = await orderRef.get()
    if (!snapshot.exists) return send(res, 404, { message: 'No encontramos ese pedido.' })

    if (action === 'fulfillment') {
      const fulfillmentStatus = String(req.body?.fulfillmentStatus || '').trim()
      if (!FULFILLMENT_STATUSES.has(fulfillmentStatus)) return send(res, 400, { message: 'El estado de preparación no es válido.' })
      if (snapshot.data()?.fulfillmentStatus === 'cancelado') return send(res, 409, { message: 'Un pedido cancelado no se puede volver a preparar.' })

      await orderRef.set({
        fulfillmentStatus,
        fulfillmentUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return send(res, 200, { ok: true, fulfillmentStatus, refreshAuth: access.refreshAuth })
    }

    if (action === 'cancel') {
      const reason = cleanReason(req.body?.reason)
      if (reason.length < 8) return send(res, 400, { message: 'Escribí un motivo breve para la cancelación.' })

      await orderRef.set({
        fulfillmentStatus: 'cancelado',
        cancellationReason: reason,
        cancelledAt: FieldValue.serverTimestamp(),
        fulfillmentUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      const current = (await orderRef.get()).data() || {}
      const delivery = await notifyOrderCancellation({
        db,
        reference: current.reference || orderId,
        order: current,
        reason,
      })
      return send(res, 200, {
        ok: true,
        fulfillmentStatus: 'cancelado',
        refreshAuth: access.refreshAuth,
        emailSent: Boolean(delivery && !delivery.skipped),
        emailDelivery: delivery?.reason || 'sent',
      })
    }

    return send(res, 400, { message: 'La acción solicitada no es válida.' })
  } catch (error) {
    console.error('[admin-order] No se pudo actualizar el pedido.', { name: error?.name, message: error?.message })
    return send(res, 500, { message: 'No se pudo actualizar el pedido. Probá nuevamente.' })
  }
}
