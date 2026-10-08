import { createHash } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { getAdminApp } from '../server/firebase-admin.js'

const ALLOWED_FOLDERS = {
  products: 'fenixis/products',
  designs: 'fenixis/designs',
}

function send(res, status, body) {
  res.status(status).json(body)
}

async function isStoreAdmin(request) {
  const authorization = request.headers.authorization || ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!idToken) return false
  const app = getAdminApp()
  if (!app) return false
  const decoded = await getAuth(app).verifyIdToken(idToken)
  return decoded.admin === true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método no permitido.' })

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return send(res, 503, { message: 'La carga de imágenes todavía no está configurada.' })

  try {
    if (!getAdminApp()) return send(res, 503, { message: 'La seguridad del panel todavía no está configurada.' })
    if (!(await isStoreAdmin(req))) return send(res, 403, { message: 'Tu cuenta no tiene permiso para cargar imágenes.' })
    const folder = ALLOWED_FOLDERS[req.body?.kind]
    if (!folder) return send(res, 400, { message: 'El destino de la imagen no es válido.' })

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex')
    return send(res, 200, { cloudName, apiKey, folder, timestamp, signature })
  } catch {
    return send(res, 500, { message: 'No se pudo preparar la carga de la imagen.' })
  }
}
