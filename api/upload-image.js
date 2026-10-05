import { createHash } from 'node:crypto'

const ALLOWED_FOLDERS = {
  products: 'fenixis/products',
  designs: 'fenixis/designs',
}

function send(res, status, body) {
  res.status(status).json(body)
}

async function isSignedIn(request) {
  const authorization = request.headers.authorization || ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDnhBOiA2daTnPlgS4CB-rCk6JxmaKL4DI'

  if (!idToken) return false

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const data = await response.json().catch(() => ({}))
  return response.ok && Array.isArray(data.users) && data.users.length > 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { message: 'Método no permitido.' })

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return send(res, 503, { message: 'La carga de imágenes todavía no está configurada.' })

  try {
    if (!(await isSignedIn(req))) return send(res, 401, { message: 'Tu sesión venció. Volvé a ingresar al panel.' })
    const folder = ALLOWED_FOLDERS[req.body?.kind]
    if (!folder) return send(res, 400, { message: 'El destino de la imagen no es válido.' })

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex')
    return send(res, 200, { cloudName, apiKey, folder, timestamp, signature })
  } catch {
    return send(res, 500, { message: 'No se pudo preparar la carga de la imagen.' })
  }
}
