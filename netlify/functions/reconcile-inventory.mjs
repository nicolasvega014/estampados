import { getAdminFirestore } from '../../server/firebase-admin.js'
import { reconcileInventoryReservation } from '../../server/inventory.js'

export default async function reconcileInventory() {
  const db = getAdminFirestore()
  if (!db) return
  // Equality plus document-id ordering uses built-in indexes only. A small
  // round-robin batch avoids repeatedly inspecting the same uncertain orders.
  const cursorRef = db.collection('internalMaintenance').doc('inventory')
  const cursor = (await cursorRef.get()).data()?.after || ''
  let query = db.collection('inventoryReservations').where('state', '==', 'reserved').orderBy('__name__').limit(15)
  if (cursor) query = query.startAfter(cursor)
  const snapshot = await query.get()
  await Promise.all(snapshot.docs.map(async (entry) => {
    try { await reconcileInventoryReservation({ db, reservation: entry.data(), accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' }) }
    catch { console.error('No se pudo conciliar una reserva de inventario; se reintentará.') }
  }))
  await cursorRef.set({ after: snapshot.size === 15 ? snapshot.docs.at(-1).id : '' })
}

export const config = { schedule: '*/15 * * * *' }
