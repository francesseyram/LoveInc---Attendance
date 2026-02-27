import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'

const SERVICES = 'services'

/** Create a new service and set it as the active one. Returns the new service ID. */
export async function createService(data, createdByUid) {
  const batch = writeBatch(db)

  // Deactivate all existing services
  const activeSnap = await getDocs(query(collection(db, SERVICES), where('isActive', '==', true)))
  activeSnap.docs.forEach(d => batch.update(d.ref, { isActive: false }))

  // Commit deactivations first
  await batch.commit()

  // Add new service doc
  const ref = await addDoc(collection(db, SERVICES), {
    name:      data.name.trim(),
    date:      data.date,
    time:      data.time,
    type:      data.type,
    isActive:  true,
    createdAt: serverTimestamp(),
    createdBy: createdByUid || '',
  })

  return ref.id
}

/** Get all services, newest first. */
export async function getAllServices() {
  const q = query(collection(db, SERVICES), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Get the currently active service. Returns null if none. */
export async function getActiveService() {
  const q = query(collection(db, SERVICES), where('isActive', '==', true))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

/** Get a service by ID. */
export async function getServiceById(serviceId) {
  const snap = await getDoc(doc(db, SERVICES, serviceId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Set a specific service as active (deactivates all others). */
export async function setActiveService(serviceId) {
  const batch = writeBatch(db)
  const allSnap = await getDocs(collection(db, SERVICES))
  allSnap.docs.forEach(d => {
    batch.update(d.ref, { isActive: d.id === serviceId })
  })
  await batch.commit()
}
