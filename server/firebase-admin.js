import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

let adminApp
let firestore

function parseServiceAccount(raw) {
  try {
    const account = JSON.parse(raw)
    if (account.project_id && account.client_email && account.private_key) return account
  } catch {
    throw new Error('La configuración privada de Firebase no es válida.')
  }

  throw new Error('La configuración privada de Firebase está incompleta.')
}

function serviceAccountFromBase64(encoded) {
  const normalized = encoded.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')

  if (
    !normalized ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) ||
    normalized.length % 4 === 1
  ) {
    throw new Error('La configuración privada de Firebase no es válida.')
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  try {
    return parseServiceAccount(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    throw new Error('La configuración privada de Firebase no es válida.')
  }
}

function serviceAccountFromEnvironment() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (encoded !== undefined) {
    return serviceAccountFromBase64(encoded)
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (raw) {
    return parseServiceAccount(raw)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId && !clientEmail && !privateKey) return null
  if (!projectId || !clientEmail || !privateKey) throw new Error('La configuración privada de Firebase está incompleta.')

  return { project_id: projectId, client_email: clientEmail, private_key: privateKey }
}

/**
 * Returns an Admin Firestore instance for private checkout work. This never uses
 * browser credentials, so coupon documents can remain unreadable to visitors.
 */
export function getAdminApp() {
  if (adminApp) return adminApp
  const serviceAccount = serviceAccountFromEnvironment()
  if (!serviceAccount) return null

  const appName = 'fenixis-checkout'
  adminApp = getApps().some((item) => item.name === appName)
    ? getApp(appName)
    : initializeApp({ credential: cert(serviceAccount) }, appName)
  return adminApp
}

export function getAdminFirestore() {
  if (firestore) return firestore
  const app = getAdminApp()
  if (!app) return null

  firestore = getFirestore(app)
  return firestore
}

export { FieldValue }
