import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'

const SERVICES = 'services'

/**
 * Create a new service and set it as the active one.
 * Returns the new service ID.
 */
export async function createService(data, createdByUid) {
  const batch = writeBatch(db)

  // Deactivate all existing active services
  const activeSnap = await getDocs(query(collection(db, SERVICES), where('isActive', '==', true)))
  activeSnap.docs.forEach(d => batch.update(d.ref, { isActive: false }))
  await batch.commit()

  const ref = await addDoc(collection(db, SERVICES), {
    name:        data.name.trim(),
    date:        data.date,
    time:        data.time,
    type:        data.type,
    isActive:    true,
    isCompleted: false,
    createdAt:   serverTimestamp(),
    createdBy:   createdByUid || '',
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
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/** Get a service by ID. */
export async function getServiceById(serviceId) {
  const snap = await getDoc(doc(db, SERVICES, serviceId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Set a specific service as active (deactivates all others). */
export async function setActiveService(serviceId) {
  const batch   = writeBatch(db)
  const allSnap = await getDocs(collection(db, SERVICES))
  allSnap.docs.forEach(d => {
    batch.update(d.ref, { isActive: d.id === serviceId })
  })
  await batch.commit()
}

/**
 * Mark a service as completed.
 * Sets isActive → false, isCompleted → true.
 * No one can check in to a completed service.
 */
export async function completeService(serviceId) {
  await updateDoc(doc(db, SERVICES, serviceId), {
    isActive:    false,
    isCompleted: true,
    completedAt: serverTimestamp(),
  })
}

/**
 * Permanently delete a service document.
 * Firestore attendance records referencing this service are kept (orphaned) —
 * delete them separately if needed.
 * Only superadmins should be able to trigger this from the UI.
 */
export async function deleteService(serviceId) {
  await deleteDoc(doc(db, SERVICES, serviceId))
}
