import {
  arrayUnion,
  collection,
  doc,
  addDoc,
  setDoc,
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

/**
 * Canonical key for a member. Members are keyed by phone number, so any way a
 * person types theirs — 0207672476, 207672476, (+233) 207 672 476 — must resolve
 * to one value. Returns '' when the input isn't a usable phone number.
 */
export function normalizePhoneKey(input) {
  if (!input) return ''
  const raw = String(input).trim()
  if (isStaffAccountStudentId(raw)) return raw          // auth-{uid} passes through
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00233')) d = d.slice(5)
  else if (d.startsWith('233')) d = d.slice(3)
  d = d.replace(/^0+/, '')
  if (d.length === 9) return `+233${d}`                 // Ghana
  if (d.length >= 10 && d.length <= 14) return `+${d}`  // international, already has a country code
  return ''
}

/** Human-friendly label for the Members UI (hides raw `auth-…` ids, shows phones locally). */
export function formatStudentIdForDisplay(studentId) {
  if (!studentId) return '—'
  if (isStaffAccountStudentId(studentId)) return 'Staff (login)'
  const gh = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(studentId)
  if (gh) return `0${gh[1]} ${gh[2]} ${gh[3]}`
  return studentId
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December']

/**
 * Members imported from the church roster often have only a day and month —
 * no year was ever recorded. `birthdayMD` ('MM-DD') holds those; `birthday`
 * holds a full 'YYYY-MM-DD' when the year is actually known. Never invent a year.
 */
export function formatBirthday(member) {
  const md = member?.birthdayMD || (member?.birthday ? member.birthday.slice(5) : '')
  if (!/^\d{2}-\d{2}$/.test(md)) return '—'
  const [mm, dd] = md.split('-').map(Number)
  if (!MONTH_NAMES[mm - 1]) return '—'
  return `${dd} ${MONTH_NAMES[mm - 1]}`
}

/** Get a single member by Firestore document ID. */
export async function getMemberById(memberId) {
  const snap = await getDoc(doc(db, MEMBERS, memberId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Look up a member by their studentId field. Returns null if not found. */
export async function getMemberByStudentId(studentId) {
  const key = normalizePhoneKey(studentId) || String(studentId || '').trim()
  const q = query(collection(db, MEMBERS), where('studentId', '==', key))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/** Look up a member by their email address. Used to resolve a signed-in admin's role. */
const ROLE_RANK = { superadmin: 3, admin: 2, leader: 1, member: 0 }

export async function getMemberByEmail(email) {
  if (!email) return null
  const q = query(collection(db, MEMBERS), where('email', '==', email.toLowerCase().trim()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  // Firestore returns docs in arbitrary order. If an email ever resolves to more
  // than one row, picking docs[0] would make the signed-in user's permissions vary
  // between sessions — always resolve to the highest-privilege row instead.
  const best = snap.docs.reduce((a, b) =>
    (ROLE_RANK[b.data().role] ?? 0) > (ROLE_RANK[a.data().role] ?? 0) ? b : a)
  return { id: best.id, ...best.data() }
}

/** Title-case a search term so it matches how names are stored ('caleb' -> 'Caleb'). */
function capitalize(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''
}

/** Last 4 digits only — enough to tell two same-named people apart without exposing the number. */
export function maskPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length < 4) return ''
  return `••• ${d.slice(-4)}`
}

const SEARCH_INDEX = ['searchIndex', 'members']

let searchCache = null

/** Drop the cached roster — call after a new member is created mid-session. */
export function invalidateMemberSearchCache() {
  searchCache = null
}

/** The roster squeezed into one document: id, name, class, hostel, phone key. */
function toIndexEntry(m) {
  const last = m.lastName && m.lastName !== '—' ? m.lastName : ''
  return {
    i: m.id,
    n: `${m.firstName || ''} ${last}`.trim(),
    c: m.cohort || '',
    h: m.hostel || '',
    p: m.studentId || '',
  }
}

/** Expand an index entry back into the shape the check-in list renders. */
function fromIndexEntry(e) {
  const [firstName, ...rest] = (e.n || '').split(' ')
  return {
    id: e.i, firstName, lastName: rest.join(' '),
    cohort: e.c, hostel: e.h, studentId: e.p,
  }
}

/**
 * Rebuilds `searchIndex/members` from the roster. Costs one full read, so it is
 * an admin action, not something the check-in page does.
 */
export async function rebuildSearchIndex() {
  const snap = await getDocs(collection(db, MEMBERS))
  const entries = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => !isStaffAccountStudentId(m.studentId))
    .map(toIndexEntry)
  await setDoc(doc(db, ...SEARCH_INDEX), { entries, count: entries.length, rebuiltAt: serverTimestamp() })
  searchCache = entries
  return entries.length
}

/** Atomic append, so two people registering at once cannot clobber each other. */
async function appendToSearchIndex(member) {
  try {
    await updateDoc(doc(db, ...SEARCH_INDEX), { entries: arrayUnion(toIndexEntry(member)) })
  } catch {
    // No index yet, or the append failed — searchMembersByName rebuilds on miss.
    searchCache = null
  }
}

/**
 * Find members by any part of their name.
 *
 * Reads ONE document (`searchIndex/members`) rather than the whole members
 * collection. The full-collection version cost 376 reads and ~107 KB per
 * device; at 200 people through a door that alone exceeded Firestore's daily
 * free read quota, and name search would have started failing mid-service.
 *
 * Firestore still has no substring search, so matching happens in JS — prefix
 * queries only match the START of a field, which missed "arthur" in
 * "Caleb Akwesie Arthur", and this roster is full of compound surnames.
 */
export async function searchMembersByName(term) {
  const cleaned = (term || '').trim().replace(/\s+/g, ' ')
  if (cleaned.length < 2) return []

  if (!searchCache) {
    const snap = await getDoc(doc(db, ...SEARCH_INDEX))
    if (snap.exists() && Array.isArray(snap.data().entries)) {
      searchCache = snap.data().entries
    } else {
      await rebuildSearchIndex()          // first run, or the index was removed
    }
  }

  const words = cleaned.toLowerCase().split(' ')
  return (searchCache || [])
    .filter(e => words.every(w => (e.n || '').toLowerCase().includes(w)))
    .sort((a, b) => (a.n || '').localeCompare(b.n || ''))
    .slice(0, 25)
    .map(fromIndexEntry)
}

/**
 * Distinct class years and hostels actually present in the roster.
 * Reuses the search cache, so this costs no extra read, and means the class
 * list maintains itself as new cohorts arrive instead of being edited in code.
 */
export async function getMemberFacets() {
  if (!searchCache) {
    const snap = await getDoc(doc(db, ...SEARCH_INDEX))
    if (snap.exists() && Array.isArray(snap.data().entries)) searchCache = snap.data().entries
    else await rebuildSearchIndex()
  }
  const cohorts = [...new Set((searchCache || []).map(e => e.c).filter(Boolean))]
  const hostels = [...new Set((searchCache || []).map(e => e.h).filter(Boolean))]
  return {
    cohorts: cohorts.sort().reverse(),   // newest class year first
    hostels: hostels.sort(),
  }
}

/** Create a new member document. Returns the new document ID. */
export async function createMember(data) {
  const ref = await addDoc(collection(db, MEMBERS), {
    firstName:  data.firstName.trim(),
    lastName:   data.lastName.trim(),
    studentId:  normalizePhoneKey(data.studentId) || data.studentId.trim(),
    phone:      normalizePhoneKey(data.phone || data.studentId) || (data.phone?.trim() || ''),
    email:      (data.email?.trim() || '').toLowerCase(),
    birthday:   data.birthday || '',
    birthdayMD: data.birthdayMD || (data.birthday ? data.birthday.slice(5) : ''),
    cohort:     data.cohort || '',
    hostel:     data.hostel || '',
    role:       'member',
    joinedDate: serverTimestamp(),
    createdBy:  data.createdBy || 'self',
  })
  await appendToSearchIndex({ id: ref.id, ...data, studentId: normalizePhoneKey(data.studentId) || data.studentId })
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

  // Keyed by uid, not a random id: two concurrent sign-ins can both see "no member
  // row yet" and race here, and addDoc would happily create a duplicate.
  const ref = doc(db, MEMBERS, firebaseUser.uid)
  await setDoc(ref, {
    firstName,
    lastName,
    studentId,
    phone: '',
    email,
    birthday: '',
    role: 'admin',
    joinedDate: serverTimestamp(),
    createdBy: 'auth_sync',
  }, { merge: true })
  const snap = await getDoc(ref)
  return { id: ref.id, ...snap.data() }
}
