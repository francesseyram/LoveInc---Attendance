/**
 * Seed the `members` collection from the Love Inc Ashesi roster.
 *
 *   node scripts/seed-members.mjs            # dry run — reports what it WOULD write
 *   node scripts/seed-members.mjs --commit   # actually writes to Firestore
 *
 * Idempotent: members are keyed by `studentId` (the normalized phone number), so
 * re-running skips anyone already present rather than creating duplicates.
 *
 * Source data is scripts/members-seed.json, generated from the roster spreadsheet
 * "Love Inc Ashesi Database.xlsx". See the import notes in CLAUDE.md.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

// ─── env ──────────────────────────────────────────────────────
// Vite injects import.meta.env in the browser; plain Node needs the file parsed.
const env = {}
const ENV_FILE = process.env.SEED_ENV_FILE || '.env'
for (const line of readFileSync(join(root, ENV_FILE), 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m) env[m[1]] = m[2].trim()
}

const app = initializeApp({
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

const COMMIT = process.argv.includes('--commit')
const seed = JSON.parse(readFileSync(join(here, 'members-seed.json'), 'utf8'))

console.log(`\nProject   ${env.VITE_FIREBASE_PROJECT_ID}`)
console.log(`Mode      ${COMMIT ? 'COMMIT — writing to Firestore' : 'DRY RUN — no writes'}`)
console.log(`Roster    ${seed.length} members\n`)

// ─── skip anyone already in the collection ────────────────────
const existing = await getDocs(collection(db, 'members'))
const taken = new Map()
existing.forEach(d => {
  const id = d.data().studentId
  if (id) taken.set(id, `${d.data().firstName} ${d.data().lastName}`)
})
console.log(`Already in Firestore: ${existing.size} member docs (${taken.size} with a studentId)`)

const toWrite = seed.filter(m => !taken.has(m.studentId))
const skipped = seed.filter(m => taken.has(m.studentId))
console.log(`To insert: ${toWrite.length}   Skipping (already present): ${skipped.length}`)
if (skipped.length) {
  for (const m of skipped.slice(0, 10)) {
    console.log(`   skip  ${m.studentId}  ${m.firstName} ${m.lastName}  (exists as "${taken.get(m.studentId)}")`)
  }
  if (skipped.length > 10) console.log(`   … and ${skipped.length - 10} more`)
}

if (!COMMIT) {
  console.log('\nSample of what would be written:')
  for (const m of toWrite.slice(0, 3)) console.log('  ', JSON.stringify(m))
  console.log('\nDry run complete. Re-run with --commit to write.\n')
  process.exit(0)
}

// ─── write in batches (Firestore caps a batch at 500 ops) ─────
let written = 0
for (let i = 0; i < toWrite.length; i += 400) {
  const batch = writeBatch(db)
  for (const m of toWrite.slice(i, i + 400)) {
    batch.set(doc(collection(db, 'members')), {
      ...m,
      role:       'member',
      joinedDate: serverTimestamp(),
      createdBy:  'roster-import',
    })
  }
  await batch.commit()
  written += Math.min(400, toWrite.length - i)
  console.log(`  committed ${written}/${toWrite.length}`)
}
console.log(`\nDone. Inserted ${written} members.\n`)
process.exit(0)
