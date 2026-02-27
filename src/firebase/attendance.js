import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './config'

const ATTENDANCE = 'attendance'

/**
 * Check if a member has already checked in for a service.
 * Returns true if a duplicate exists.
 */
export async function hasCheckedIn(memberId, serviceId) {
  const q = query(
    collection(db, ATTENDANCE),
    where('memberId',  '==', memberId),
    where('serviceId', '==', serviceId)
  )
  const snap = await getDocs(q)
  return !snap.empty
}

/**
 * Log a check-in for a member + service.
 * Returns the new attendance document ID.
 */
export async function checkIn(memberId, serviceId, isNew = false) {
  const ref = await addDoc(collection(db, ATTENDANCE), {
    memberId,
    serviceId,
    checkedInAt: serverTimestamp(),
    isNew,
  })
  return ref.id
}

/**
 * Get all attendance records for a specific service.
 */
export async function getAttendanceForService(serviceId) {
  const q = query(
    collection(db, ATTENDANCE),
    where('serviceId', '==', serviceId),
    orderBy('checkedInAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Get all attendance records for a specific member (their history).
 */
export async function getAttendanceForMember(memberId) {
  const q = query(
    collection(db, ATTENDANCE),
    where('memberId', '==', memberId),
    orderBy('checkedInAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Subscribe to real-time attendance updates for a service.
 * Calls callback(records[]) whenever the collection changes.
 * Returns the unsubscribe function.
 */
export function subscribeToServiceAttendance(serviceId, callback) {
  const q = query(
    collection(db, ATTENDANCE),
    where('serviceId', '==', serviceId),
    orderBy('checkedInAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(records)
  })
}

/**
 * Get the count of check-ins for a service (one-shot).
 */
export async function getServiceAttendanceCount(serviceId) {
  const q = query(collection(db, ATTENDANCE), where('serviceId', '==', serviceId))
  const snap = await getDocs(q)
  return snap.size
}
