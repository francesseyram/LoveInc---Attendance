import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './config'

const ATTENDANCE = 'attendance'

/**
 * Check if a member has already checked in for a service.
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
 * Log a check-in. Returns the new attendance document ID.
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
 * Get all attendance records for a specific service (one-shot).
 * Sorts client-side to avoid needing a Firestore composite index.
 */
export async function getAttendanceForService(serviceId) {
  const q = query(collection(db, ATTENDANCE), where('serviceId', '==', serviceId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.checkedInAt?.seconds ?? 0) - (b.checkedInAt?.seconds ?? 0))
}

/**
 * Get all attendance records for a specific member (their history).
 * Sorts client-side — newest first.
 */
export async function getAttendanceForMember(memberId) {
  const q = query(collection(db, ATTENDANCE), where('memberId', '==', memberId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.checkedInAt?.seconds ?? 0) - (a.checkedInAt?.seconds ?? 0))
}

/**
 * Real-time subscription to attendance for a service.
 * Uses only a `where` clause (no orderBy) to avoid needing a Firestore composite index.
 * Sorts results client-side so they're always in check-in order.
 * Returns the unsubscribe function.
 */
export function subscribeToServiceAttendance(serviceId, callback) {
  const q = query(
    collection(db, ATTENDANCE),
    where('serviceId', '==', serviceId)
  )

  return onSnapshot(q, (snap) => {
    const records = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.checkedInAt?.seconds ?? 0) - (b.checkedInAt?.seconds ?? 0))
    callback(records)
  }, (error) => {
    console.error('Attendance subscription error:', error)
  })
}

/**
 * Get the check-in count for a service (one-shot).
 */
export async function getServiceAttendanceCount(serviceId) {
  const q = query(collection(db, ATTENDANCE), where('serviceId', '==', serviceId))
  const snap = await getDocs(q)
  return snap.size
}
