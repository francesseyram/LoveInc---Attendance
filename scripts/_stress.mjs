import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore'
const env={}; for(const l of readFileSync('.env.sandbox','utf8').split('\n')){const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if(m)env[m[1]]=m[2].trim()}
const db=getFirestore(initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:env.VITE_FIREBASE_APP_ID}))
const t0=Date.now()
const svc=(await getDocs(query(collection(db,'services'),where('isActive','==',true)))).docs[0]
const members=(await getDocs(collection(db,'members'))).docs.map(d=>d.id)
console.log(`sandbox: service="${svc.data().name}"  members=${members.length}`)

// ── 1. full-roster read, as every check-in device performs on first search ──
const r0=Date.now(); const snap=await getDocs(collection(db,'members'))
const bytes=JSON.stringify(snap.docs.map(d=>d.data())).length
console.log(`\n1. roster read (per device, once)   ${Date.now()-r0} ms, ${snap.size} docs, ~${Math.round(bytes/1024)} KB`)

// ── 2. the check-in path as written: hasCheckedIn() then checkIn() ──
const hasCheckedIn=async(mid,sid)=>!(await getDocs(query(collection(db,'attendance'),where('memberId','==',mid),where('serviceId','==',sid)))).empty
const checkIn=(mid,sid)=>addDoc(collection(db,'attendance'),{memberId:mid,serviceId:sid,checkedInAt:serverTimestamp(),isNew:false})

const N=200
const pool=members.slice(0,N)
const c0=Date.now()
const results=await Promise.allSettled(pool.map(async mid=>{
  if (await hasCheckedIn(mid,svc.id)) return 'dup-blocked'
  await checkIn(mid,svc.id); return 'ok'
}))
const ok=results.filter(r=>r.status==='fulfilled'&&r.value==='ok').length
const failed=results.filter(r=>r.status==='rejected')
const ms=Date.now()-c0
console.log(`2. ${N} concurrent check-ins        ${ms} ms  (${Math.round(N/(ms/1000))}/s)  ok=${ok} blocked=${results.length-ok-failed.length} errors=${failed.length}`)
if (failed.length) console.log('   first error:', failed[0].reason?.code || failed[0].reason?.message)

// ── 3. race: same person taps twice at the same instant ──
const victim=members[N+1]
const race=await Promise.allSettled([0,1,2,3,4].map(async()=>{
  if (await hasCheckedIn(victim,svc.id)) return 'blocked'
  await checkIn(victim,svc.id); return 'wrote'
}))
const wrote=race.filter(r=>r.value==='wrote').length
const rows=(await getDocs(query(collection(db,'attendance'),where('memberId','==',victim),where('serviceId','==',svc.id)))).size
console.log(`3. same member, 5 simultaneous     wrote=${wrote}  attendance rows now=${rows}  ${rows>1?'*** DUPLICATES CREATED ***':'ok'}`)

// ── 4. what the admin loads on every visit ──
const a0=Date.now(); const att=await getDocs(collection(db,'attendance'))
console.log(`4. admin analytics read            ${Date.now()-a0} ms, attendance=${att.size} docs`)
console.log(`\ntotal ${Date.now()-t0} ms`)
process.exit(0)
