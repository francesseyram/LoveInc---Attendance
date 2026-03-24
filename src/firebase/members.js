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

/** Synthetic student IDs for accounts that only exist in Firebase Auth (admins). Never collides with real student IDs. */
export const STAFF_STUDENT_ID_PREFIX = 'auth-'

export function isStaffAccountStudentId(studentId) {
  return typeof studentId === 'string' && studentId.startsWith(STAFF_STUDENT_ID_PREFIX)
}

/** Human-friendly label for the Members UI (hides raw `auth-…` ids). */
export function formatStudentIdForDisplay(studentId) {
  if (!studentId) return '—'
  if (isStaffAccountStudentId(studentId)) return 'Staff (login)'
  return studentId
}

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
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/** Look up a member by their email address. Used to resolve a signed-in admin's role. */
export async function getMemberByEmail(email) {
  if (!email) return null
  const q = query(collection(db, MEMBERS), where('email', '==', email.toLowerCase().trim()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/** Create a new member document. Returns the new document ID. */
export async function createMember(data) {
  const ref = await addDoc(collection(db, MEMBERS), {
    firstName:  data.firstName.trim(),
    lastName:   data.lastName.trim(),
    studentId:  data.studentId.trim(),
    phone:      data.phone?.trim()  || '',
    email:      (data.email?.trim() || '').toLowerCase(),
    birthday:   data.birthday || '',
    role:       'member',
    joinedDate: serverTimestamp(),
    createdBy:  data.createdBy || 'self',
  })
  return ref.id
}

/** Roles a regular admin may assign (not Super Admin). */
export const ROLES_ASSIGNABLE_BY_ADMIN = ['member', 'leader']

/** All roles — only Super Admins may assign `admin` and `superadmin`. */
export const ROLES_ASSIGNABLE_BY_SUPERADMIN = ['member', 'leader', 'admin', 'superadmin']

/**
 * Validates a role change. Returns `null` if allowed, or a user-facing error string.
 * @param {string|null|undefined} actorRole — signed-in user's `members.role`
 * @param {string|undefined} targetCurrentRole — target member's current role
 * @param {string} newRole — desired new role
 */
export function validateRoleAssignment(actorRole, targetCurrentRole, newRole) {
  const all = ['member', 'leader', 'admin', 'superadmin']
  if (!all.includes(newRole)) return 'Invalid role.'
  if (!actorRole) return 'Could not verify your account permissions.'

  if (actorRole === 'superadmin') return null

  // Only Super Admins and Admins may change roles (not Leader/Member)
  if (actorRole !== 'admin') {
    return 'Only Super Admins and Admins can change roles.'
  }

  // Regular Admin: cannot assign admin or superadmin
  if (newRole === 'admin' || newRole === 'superadmin') {
    return 'Only Super Admins can assign Admin or Super Admin roles.'
  }

  // Regular Admin: cannot change existing Admin or Super Admin accounts
  if (targetCurrentRole === 'admin' || targetCurrentRole === 'superadmin') {
    return 'Only Super Admins can change roles for Admin accounts.'
  }

  return null
}

/** Update a member's role. Prefer validating with `validateRoleAssignment` in the UI first. */
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

/**
 * Ensures a Firestore `members` row exists for a Firebase Auth user (admins who were
 * added in Authentication but never checked in). Creates one with role `admin` and
 * a synthetic `studentId` of `auth-{uid}` so they appear in the Members tab and
 * `getMemberByEmail` works for superadmin checks.
 */
export async function ensureMemberForAuthUser(firebaseUser) {
  if (!firebaseUser?.email) return null

  const email = firebaseUser.email.toLowerCase().trim()
  let member = await getMemberByEmail(email)
  if (member) return member

  const studentId = `${STAFF_STUDENT_ID_PREFIX}${firebaseUser.uid}`
  if (await studentIdExists(studentId)) {
    return await getMemberByStudentId(studentId)
  }

  const displayName = firebaseUser.displayName?.trim() || ''
  let firstName = 'Admin'
  let lastName = 'User'
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean)
    firstName = parts[0] || firstName
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : lastName
  } else {
    const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
    const words = local.split(/\s+/).filter(Boolean)
    if (words.length) {
      firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
      lastName = words.length > 1
        ? words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
        : 'User'
    }
  }

  const ref = await addDoc(collection(db, MEMBERS), {
    firstName,
    lastName,
    studentId,
    phone: '',
    email,
    birthday: '',
    role: 'admin',
    joinedDate: serverTimestamp(),
    createdBy: 'auth_sync',
  })
  const snap = await getDoc(ref)
  return { id: ref.id, ...snap.data() }
}
