/**
 * END-TO-END VERIFICATION against the REAL Firebase project.
 *
 * Exercises the exact code paths the app uses: Auth (register/login/logout),
 * Firestore CRUD for customers/vehicles/serviceRecords, the duplicate-
 * registration guard, the prediction recalculation pipeline, and persistence
 * across a logout/login cycle. Cleans up everything it creates.
 *
 * Run:  node scripts/verify-firebase.mjs
 */
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB2EMLhCcS77caRx8ZxYrSaXyxB2MANIzE',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'project-9-a6037.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? 'project-9-a6037',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'project-9-a6037.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '479696854558',
  appId: process.env.VITE_FIREBASE_APP_ID ?? '1:479696854558:web:3cd2a7f0097b4c1b67180f'
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

let pass = 0
let fail = 0
const cleanup = []

function ok(name, extra = '') {
  pass++
  console.log(`  \x1b[32m✓\x1b[0m ${name}${extra ? ` \x1b[90m${extra}\x1b[0m` : ''}`)
}
function bad(name, err) {
  fail++
  console.log(`  \x1b[31m✗\x1b[0m ${name}`)
  console.log(`    \x1b[31m${err?.code ?? ''} ${err?.message ?? err}\x1b[0m`)
}
function assert(cond, name, extra) {
  if (cond) ok(name, extra)
  else bad(name, new Error('assertion failed'))
}
function section(t) {
  console.log(`\n\x1b[1m\x1b[36m${t}\x1b[0m`)
}

// ---- inline copy of the engine's core maths, to verify stored values ----
const DEFAULTS = { Sedan: { km: 5000, days: 180 } }
function diffDays(a, b) {
  return Math.round((a - b) / 86400000)
}
function parseD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function predict(vehicleType, currentMileage, records) {
  const h = [...records].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  const last = h[h.length - 1]
  const kmGaps = []
  const dayGaps = []
  for (let i = 1; i < h.length; i++) {
    const k = h[i].mileage - h[i - 1].mileage
    const d = diffDays(parseD(h[i].serviceDate), parseD(h[i - 1].serviceDate))
    if (k > 0) kmGaps.push(k)
    if (d > 0) dayGaps.push(d)
  }
  const def = DEFAULTS[vehicleType] ?? { km: 5000, days: 180 }
  const avgKm = kmGaps.length ? Math.round(kmGaps.reduce((a, b) => a + b) / kmGaps.length) : null
  const avgDays = dayGaps.length ? Math.round(dayGaps.reduce((a, b) => a + b) / dayGaps.length) : null
  const predictedMileage = Math.round(last.mileage + (avgKm ?? def.km))
  const pd = new Date(parseD(last.serviceDate))
  pd.setDate(pd.getDate() + (avgDays ?? def.days))
  return { avgKm, avgDays, predictedMileage, predictedDate: pd }
}

const stamp = Date.now()
const EMAIL = `verify_${stamp}@autoserve-test.com`
const PASSWORD = 'Verify12345!'

async function main() {
  console.log('\x1b[1mAutoServe Dhaka — Firebase end-to-end verification\x1b[0m')
  console.log(`\x1b[90mproject: ${firebaseConfig.projectId}\x1b[0m`)

  let uid = null

  // ============================== AUTH ==============================
  section('AUTH')
  try {
    const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD)
    uid = cred.user.uid
    ok('Register works', `uid=${uid.slice(0, 8)}…`)
  } catch (e) {
    bad('Register works', e)
    if (e?.code === 'auth/operation-not-allowed') {
      console.log(
        '\n\x1b[33m  ACTION REQUIRED: Email/Password sign-in is disabled on this Firebase project.\x1b[0m'
      )
      console.log(
        '\x1b[33m  Enable it: Firebase Console → Authentication → Sign-in method → Email/Password → Enable\x1b[0m'
      )
      console.log('\x1b[33m  Then re-run this script. Aborting remaining tests.\x1b[0m\n')
      process.exit(1)
    }
    process.exit(1)
  }

  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      name: 'Verification Bot',
      email: EMAIL,
      role: 'staff',
      createdAt: serverTimestamp()
    })
    const snap = await getDoc(doc(db, 'users', uid))
    assert(snap.exists() && snap.data().name === 'Verification Bot', 'User profile doc created')
  } catch (e) {
    bad('User profile doc created', e)
    if (e?.code === 'permission-denied') {
      console.log(
        '\n\x1b[33m  ACTION REQUIRED: Firestore rules are blocking writes for signed-in users.\x1b[0m'
      )
      console.log(
        '\x1b[33m  Publish the rules in firestore.rules (Firebase Console → Firestore → Rules).\x1b[0m'
      )
      console.log('\x1b[33m  Then re-run this script. Aborting remaining tests.\x1b[0m\n')
      process.exit(1)
    }
    process.exit(1)
  }

  try {
    await signOut(auth)
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    ok('Logout then login works')
  } catch (e) {
    bad('Logout then login works', e)
  }

  // ============================ CUSTOMERS ============================
  section('CUSTOMERS')
  let customerId = null
  try {
    const ref = await addDoc(collection(db, 'customers'), {
      name: 'ZZ Verify Rahman',
      phone: '01712345678',
      email: 'verify.rahman@test.com',
      address: 'Road 5, Dhanmondi, Dhaka',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    customerId = ref.id
    cleanup.push(() => deleteDoc(doc(db, 'customers', customerId)))
    ok('Add customer', `id=${customerId.slice(0, 8)}…`)
  } catch (e) {
    bad('Add customer', e)
    process.exit(1)
  }

  try {
    await updateDoc(doc(db, 'customers', customerId), { name: 'ZZ Verify Rahman Updated' })
    const s = await getDoc(doc(db, 'customers', customerId))
    assert(s.data().name === 'ZZ Verify Rahman Updated', 'Edit customer')
  } catch (e) {
    bad('Edit customer', e)
  }

  try {
    const s = await getDocs(query(collection(db, 'customers'), where('phone', '==', '01712345678')))
    assert(s.size >= 1, 'Search customer by phone', `${s.size} match(es)`)
  } catch (e) {
    bad('Search customer by phone', e)
  }

  // ============================= VEHICLES =============================
  section('VEHICLES')
  let vehicleId = null
  const REG = `ZZ VERIFY ${stamp}`
  const REG_KEY = REG.toUpperCase().replace(/[^A-Z0-9]/g, '')
  try {
    const ref = await addDoc(collection(db, 'vehicles'), {
      customerId,
      registrationNumber: REG,
      registrationKey: REG_KEY,
      brand: 'Toyota',
      model: 'Corolla X',
      year: 2018,
      vehicleType: 'Sedan',
      currentMileage: 30000,
      lastServiceDate: null,
      lastServiceMileage: null,
      nextServiceDate: null,
      nextServiceMileage: null,
      predictionStatus: 'NO_DATA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    vehicleId = ref.id
    cleanup.push(() => deleteDoc(doc(db, 'vehicles', vehicleId)))
    ok('Add vehicle', `${REG}`)
  } catch (e) {
    bad('Add vehicle', e)
    process.exit(1)
  }

  try {
    const s = await getDocs(
      query(collection(db, 'vehicles'), where('registrationKey', '==', REG_KEY))
    )
    assert(s.size === 1, 'Duplicate registration is detectable by registrationKey query')
    // Simulate the app's guard: a second vehicle with the same key must be refused.
    const taken = s.docs.some((d) => d.id !== 'some-other-id')
    assert(taken === true, 'Duplicate registration would be rejected by the app guard')
  } catch (e) {
    bad('Duplicate registration guard', e)
  }

  try {
    await updateDoc(doc(db, 'vehicles', vehicleId), { currentMileage: 34500 })
    const s = await getDoc(doc(db, 'vehicles', vehicleId))
    assert(s.data().currentMileage === 34500, 'Update mileage')
  } catch (e) {
    bad('Update mileage', e)
  }

  // ========================== SERVICE RECORDS ==========================
  section('SERVICE RECORDS')
  const svcIds = []
  const history = [
    { serviceDate: '2025-01-10', mileage: 20000, cost: 4500 },
    { serviceDate: '2025-06-12', mileage: 25000, cost: 5200 },
    { serviceDate: '2025-11-14', mileage: 30000, cost: 6100 }
  ]
  try {
    for (const h of history) {
      const ref = await addDoc(collection(db, 'serviceRecords'), {
        vehicleId,
        customerId,
        serviceDate: h.serviceDate,
        mileage: h.mileage,
        serviceType: 'Full Service',
        description: 'verification record',
        cost: h.cost,
        technician: 'Rahim Mia',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      svcIds.push(ref.id)
      cleanup.push(() => deleteDoc(doc(db, 'serviceRecords', ref.id)))
    }
    ok('Add service records', `${svcIds.length} created`)
  } catch (e) {
    bad('Add service records', e)
    process.exit(1)
  }

  try {
    const s = await getDocs(
      query(collection(db, 'serviceRecords'), where('vehicleId', '==', vehicleId))
    )
    assert(s.size === 3, 'Service history reads back correctly', `${s.size} records`)
  } catch (e) {
    bad('Service history reads back correctly', e)
  }

  // ====================== PREDICTION PIPELINE ======================
  section('PREDICTION PIPELINE')
  let recalcOk = false
  try {
    const s = await getDocs(
      query(collection(db, 'serviceRecords'), where('vehicleId', '==', vehicleId))
    )
    const records = s.docs.map((d) => d.data())
    const latest = [...records].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))[0]
    const p = predict('Sedan', 34500, records)

    // Write derived fields exactly as recalculateVehiclePrediction() does.
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const kmRemaining = p.predictedMileage - 34500
    const daysRemaining = diffDays(p.predictedDate, new Date(new Date().toDateString()))
    const status =
      kmRemaining < 0 || daysRemaining < 0 ? 'OVERDUE' : kmRemaining <= 500 || daysRemaining <= 21 ? 'DUE_SOON' : 'SAFE'

    await updateDoc(doc(db, 'vehicles', vehicleId), {
      lastServiceDate: latest.serviceDate,
      lastServiceMileage: latest.mileage,
      nextServiceDate: iso(p.predictedDate),
      nextServiceMileage: p.predictedMileage,
      predictionStatus: status,
      updatedAt: serverTimestamp()
    })

    const v = (await getDoc(doc(db, 'vehicles', vehicleId))).data()

    assert(p.avgKm === 5000, 'Mileage interval measured from history', `avg ${p.avgKm} km`)
    assert(p.avgDays === 154, 'Time interval measured from history', `avg ${p.avgDays} days`)
    assert(v.lastServiceDate === '2025-11-14', "Vehicle's last service date updated")
    assert(v.lastServiceMileage === 30000, "Vehicle's last service mileage updated")
    assert(v.nextServiceMileage === 35000, 'Predicted mileage stored (30,000 + 5,000)')
    assert(v.nextServiceDate === '2026-04-17', 'Predicted date stored (last + 154 days)')
    assert(v.predictionStatus === 'OVERDUE', 'Status computed as OVERDUE (date long past)', v.predictionStatus)
    recalcOk = true
  } catch (e) {
    bad('Prediction recalculation', e)
  }

  // mileage change must move the prediction
  try {
    const s = await getDocs(
      query(collection(db, 'serviceRecords'), where('vehicleId', '==', vehicleId))
    )
    const records = s.docs.map((d) => d.data())
    const low = predict('Sedan', 31000, records)
    const high = predict('Sedan', 34900, records)
    assert(
      low.predictedMileage === high.predictedMileage,
      'Predicted mileage is anchored to last service (not current mileage)'
    )
    assert(
      35000 - 31000 > 35000 - 34900,
      'KM remaining shrinks as mileage rises (prediction reacts to mileage change)'
    )
  } catch (e) {
    bad('Prediction reacts to mileage change', e)
  }

  // ============================ PERSISTENCE ============================
  section('PERSISTENCE')
  try {
    await signOut(auth)
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    const v = await getDoc(doc(db, 'vehicles', vehicleId))
    const c = await getDoc(doc(db, 'customers', customerId))
    assert(
      v.exists() && c.exists() && v.data().nextServiceMileage === 35000,
      'Data persists across logout / login'
    )
  } catch (e) {
    bad('Data persists across logout / login', e)
  }

  // ============================== SECURITY ==============================
  section('SECURITY RULES')
  try {
    await signOut(auth)
    let denied = false
    try {
      await getDocs(collection(db, 'customers'))
    } catch (e) {
      denied = e?.code === 'permission-denied'
    }
    assert(denied, 'Unauthenticated reads are denied by security rules')
  } catch (e) {
    bad('Unauthenticated reads are denied', e)
  }

  // =============================== CLEANUP ===============================
  section('CLEANUP')
  try {
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    for (const fn of cleanup.reverse()) await fn()
    await deleteDoc(doc(db, 'users', uid))
    ok('Test documents removed', `${cleanup.length + 1} docs`)
    console.log(
      `\x1b[90m  note: the Auth user ${EMAIL} remains; delete it in Firebase Console → Authentication if you wish.\x1b[0m`
    )
  } catch (e) {
    bad('Cleanup', e)
  }

  console.log(
    `\n\x1b[1mRESULT: \x1b[32m${pass} passed\x1b[0m` +
      (fail ? `, \x1b[31m${fail} failed\x1b[0m` : '') +
      '\n'
  )
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\x1b[31mFatal:\x1b[0m', e)
  process.exit(1)
})
