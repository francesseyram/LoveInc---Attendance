import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const MEMBERS = 'members'

/** Get a single member by Firestore document ID. */
export async function getMemberById(memberId) {
  const snap = await getDoc(doc(db, MEMBERS, memberId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Look up a member by their studentId field. Returns null if not found. */
export async function getMemberByStudentId(studentId) {
  const q = query(collection(db, MEMBERS), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() }
}

/** Create a new member document. Returns the new document ID. */
export async function createMember(data) {
  const ref = await addDoc(collection(db, MEMBERS), {
    firstName:   data.firstName.trim(),
    lastName:    data.lastName.trim(),
    studentId:   data.studentId.trim(),
    phone:       data.phone?.trim() || '',
    email:       data.email?.trim() || '',
    birthday:    data.birthday || '',
    role:        'member',
    joinedDate:  serverTimestamp(),
    createdBy:   data.createdBy || 'self',
  })
  return ref.id
}

/** Update a member's role. */
export async function updateMemberRole(memberId, role) {
  await updateDoc(doc(db, MEMBERS, memberId), { role })
}

/** Get all members, ordered by join date (newest first). */
export async function getAllMembers() {
  const q = query(collection(db, MEMBERS), orderBy('joinedDate', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Check if a studentId already exists. */
export async function studentIdExists(studentId) {
  const member = await getMemberByStudentId(studentId)
  return !!member
}
