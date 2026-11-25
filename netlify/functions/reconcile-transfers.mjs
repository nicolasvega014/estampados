import { getAdminFirestore } from '../../server/firebase-admin.js'
import { reconcileTransferOrder } from '../../server/transfer.js'

export default async function reconcileTransfers() {
  const db = getAdminFirestore()
  if (!db) return
  const cursorRef = db.collection('internalMaintenance').doc('transfers')
  const cursor = (await cursorRef.get()).data()?.after || ''
  let query = db.collection('orders').where('paymentMethod', '==', 'transfer').orderBy('__name__').limit(15)
  if (cursor) query = query.startAfter(cursor)
  const snapshot = await query.get()
  await Promise.all(snapshot.docs.map(async (entry) => {
    try { await reconcileTransferOrder({ db, reference: entry.id }) }
    catch { console.error('Se reintentará la conciliación de una transferencia.') }
  }))
  await cursorRef.set({ after: snapshot.size === 15 ? snapshot.docs.at(-1).id : '' })
}

export const config = { schedule: '*/15 * * * *' }
