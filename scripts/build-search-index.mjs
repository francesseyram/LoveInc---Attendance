/**
 * Rebuild `searchIndex/members` — the single document the check-in page reads
 * instead of the whole members collection.
 *
 *   node scripts/build-search-index.mjs                    # production
 *   SEED_ENV_FILE=.env.sandbox node scripts/build-search-index.mjs
 *
 * Run after any bulk change to members (a roster import, mass edits). Ordinary
 * self-registration keeps the index current on its own via arrayUnion.
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const ENV_FILE = process.env.SEED_ENV_FILE || '.env'
const env = {}
for (const l of readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) env[m[1]] = m[2].trim()
}
const db = getFirestore(initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
}))

const snap = await getDocs(collection(db, 'members'))
const entries = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(m => !String(m.studentId || '').startsWith('auth-'))
  .map(m => ({
    i: m.id,
    n: `${m.firstName || ''} ${m.lastName && m.lastName !== '—' ? m.lastName : ''}`.trim(),
    c: m.cohort || '', h: m.hostel || '', p: m.studentId || '',
  }))

await setDoc(doc(db, 'searchIndex', 'members'), { entries, count: entries.length, rebuiltAt: serverTimestamp() })
const bytes = JSON.stringify(entries).length
console.log(`${env.VITE_FIREBASE_PROJECT_ID}: indexed ${entries.length} members, ${Math.round(bytes / 1024)} KB (Firestore doc limit 1024 KB)`)
process.exit(0)
