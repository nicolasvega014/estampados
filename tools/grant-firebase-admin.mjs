import { getAuth } from 'firebase-admin/auth'
import { getAdminApp } from '../server/firebase-admin.js'

const uid = String(process.argv[2] || '').trim()

if (!/^[A-Za-z0-9_-]{10,128}$/.test(uid)) {
  console.error('Indicá un UID válido de Firebase Authentication.')
  process.exit(1)
}

const app = getAdminApp()
if (!app) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON o las tres variables privadas de Firebase.')
  process.exit(1)
}

try {
  const auth = getAuth(app)
  const user = await auth.getUser(uid)
  await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true })
  console.log(`Listo: ${user.email || uid} ahora tiene acceso de administrador.`)
  console.log('Cerrá sesión y volvé a ingresar al panel para actualizar sus permisos.')
} catch (error) {
  console.error(error?.message || 'No se pudo asignar el acceso de administrador.')
  process.exit(1)
}
