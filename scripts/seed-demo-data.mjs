/**
 * Fill the SANDBOX with believable services + attendance so the Stats tab has
 * something to show: 6 past Sunday services, one active today, ~45 regulars,
 * ~35 people who stop coming after week 3, and 6 first-timers each week.
 *
 *   node scripts/seed-demo-data.mjs      # reads .env.sandbox, never .env
 *
 * Creating services requires auth under firestore.rules, so this needs the
 * sandbox rules temporarily opened, or Auth enabled and the script signed in.
 * Never point this at production.
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore'
const env={}; for(const l of readFileSync('.env.sandbox','utf8').split('\n')){const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if(m)env[m[1]]=m[2].trim()}
const db=getFirestore(initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:env.VITE_FIREBASE_APP_ID}))

const members=(await getDocs(collection(db,'members'))).docs.map(d=>({id:d.id}))
const iso=d=>d.toISOString().slice(0,10)
const now=Date.now(), WEEK=7*864e5
// 6 past services (oldest first) + 1 active today
const defs=[]
for(let i=6;i>=1;i--) defs.push({name:`Sunday Service W${7-i}`,date:iso(new Date(now-i*WEEK)),time:'10:00',type:'Sunday Service',isActive:false,isCompleted:true,ts:now-i*WEEK})
defs.push({name:'Sunday Service (Today)',date:iso(new Date(now)),time:'10:00',type:'Sunday Service',isActive:true,isCompleted:false,ts:now})

let b=writeBatch(db); const svcIds=[]
for(const d of defs){const r=doc(collection(db,'services')); svcIds.push({id:r.id,...d})
  b.set(r,{name:d.name,date:d.date,time:d.time,type:d.type,isActive:d.isActive,isCompleted:d.isCompleted,createdAt:Timestamp.fromMillis(d.ts),createdBy:'demo'})}
await b.commit()

// attendance shape: core regulars, a group that drops off, rolling first-timers
const shuffled=[...members].sort(()=>Math.random()-0.5)
const regulars=shuffled.slice(0,45), droppers=shuffled.slice(45,80), pool=shuffled.slice(80)
let ops=[]; let poolAt=0
svcIds.slice(0,6).forEach((s,idx)=>{
  const goers=new Set(regulars.map(m=>m.id))
  if(idx<3) droppers.forEach(m=>goers.add(m.id))            // stop coming after week 3
  const newbies=pool.slice(poolAt,poolAt+6); poolAt+=6      // 6 first-timers each week
  newbies.forEach(m=>goers.add(m.id))
  for(const mid of goers) ops.push({memberId:mid,serviceId:s.id,isNew:newbies.some(n=>n.id===mid),ts:s.ts+36e5})
})
for(let i=0;i<ops.length;i+=400){const bb=writeBatch(db)
  ops.slice(i,i+400).forEach(o=>bb.set(doc(collection(db,'attendance')),{memberId:o.memberId,serviceId:o.serviceId,isNew:o.isNew,checkedInAt:Timestamp.fromMillis(o.ts)}))
  await bb.commit()}
console.log(`services=${svcIds.length} attendance=${ops.length} activeService=${svcIds[6].id}`)
process.exit(0)
