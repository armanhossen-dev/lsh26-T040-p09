import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import { predictNextService, toISODate } from './prediction'
import { normalizePhone, normalizeReg } from './validation'
import type { AppUser, Customer, ServiceRecord, Vehicle } from '@/types'

export const COL = {
  users: 'users',
  customers: 'customers',
  vehicles: 'vehicles',
  services: 'serviceRecords'
} as const

/* ------------------------------- converters -------------------------------- */

function tsToISO(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null && 'seconds' in (v as Record<string, unknown>)) {
    const s = (v as { seconds: number }).seconds
    return new Date(s * 1000).toISOString()
  }
  return null
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapCustomer(d: QueryDocumentSnapshot<DocumentData>): Customer {
  const x = d.data()
  return {
    id: d.id,
    name: String(x.name ?? ''),
    phone: String(x.phone ?? ''),
    email: String(x.email ?? ''),
    address: String(x.address ?? ''),
    createdAt: tsToISO(x.createdAt),
    updatedAt: tsToISO(x.updatedAt)
  }
}

function mapVehicle(d: QueryDocumentSnapshot<DocumentData>): Vehicle {
  const x = d.data()
  return {
    id: d.id,
    customerId: String(x.customerId ?? ''),
    registrationNumber: String(x.registrationNumber ?? ''),
    registrationKey: String(x.registrationKey ?? normalizeReg(String(x.registrationNumber ?? ''))),
    brand: String(x.brand ?? ''),
    model: String(x.model ?? ''),
    year: num(x.year, new Date().getFullYear()),
    vehicleType: (x.vehicleType ?? 'Sedan') as Vehicle['vehicleType'],
    currentMileage: num(x.currentMileage),
    lastServiceDate: x.lastServiceDate ? String(x.lastServiceDate) : null,
    lastServiceMileage:
      x.lastServiceMileage === null || x.lastServiceMileage === undefined
        ? null
        : num(x.lastServiceMileage),
    nextServiceDate: x.nextServiceDate ? String(x.nextServiceDate) : null,
    nextServiceMileage:
      x.nextServiceMileage === null || x.nextServiceMileage === undefined
        ? null
        : num(x.nextServiceMileage),
    predictionStatus: (x.predictionStatus ?? 'NO_DATA') as Vehicle['predictionStatus'],
    createdAt: tsToISO(x.createdAt),
    updatedAt: tsToISO(x.updatedAt)
  }
}

function mapService(d: QueryDocumentSnapshot<DocumentData>): ServiceRecord {
  const x = d.data()
  return {
    id: d.id,
    vehicleId: String(x.vehicleId ?? ''),
    customerId: String(x.customerId ?? ''),
    serviceDate: String(x.serviceDate ?? ''),
    mileage: num(x.mileage),
    serviceType: String(x.serviceType ?? ''),
    description: String(x.description ?? ''),
    cost: num(x.cost),
    technician: String(x.technician ?? ''),
    createdAt: tsToISO(x.createdAt),
    updatedAt: tsToISO(x.updatedAt)
  }
}

/* ---------------------------------- users ---------------------------------- */

export async function createUserProfile(u: {
  uid: string
  name: string
  email: string
  role?: AppUser['role']
}): Promise<void> {
  await setDoc(
    doc(db, COL.users, u.uid),
    {
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role ?? 'staff',
      createdAt: serverTimestamp()
    },
    { merge: true }
  )
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, COL.users, uid))
  if (!snap.exists()) return null
  const x = snap.data()
  return {
    uid,
    name: String(x.name ?? ''),
    email: String(x.email ?? ''),
    role: (x.role ?? 'staff') as AppUser['role'],
    createdAt: tsToISO(x.createdAt)
  }
}

export async function updateUserProfile(uid: string, patch: { name?: string }): Promise<void> {
  await updateDoc(doc(db, COL.users, uid), { ...patch, updatedAt: serverTimestamp() })
}

/* -------------------------- realtime subscriptions ------------------------- */

type Cb<T> = (rows: T[]) => void
type ErrCb = (e: unknown) => void

export function subscribeCustomers(cb: Cb<Customer>, onError?: ErrCb) {
  return onSnapshot(
    query(collection(db, COL.customers), orderBy('name')),
    (snap) => cb(snap.docs.map(mapCustomer)),
    (e) => onError?.(e)
  )
}

export function subscribeVehicles(cb: Cb<Vehicle>, onError?: ErrCb) {
  return onSnapshot(
    query(collection(db, COL.vehicles), orderBy('registrationKey')),
    (snap) => cb(snap.docs.map(mapVehicle)),
    (e) => onError?.(e)
  )
}

export function subscribeServices(cb: Cb<ServiceRecord>, onError?: ErrCb) {
  return onSnapshot(
    query(collection(db, COL.services), orderBy('serviceDate', 'desc')),
    (snap) => cb(snap.docs.map(mapService)),
    (e) => onError?.(e)
  )
}

/* -------------------------------- customers -------------------------------- */

export async function addCustomer(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL.customers), {
    name: data.name.trim(),
    phone: normalizePhone(data.phone),
    email: data.email.trim().toLowerCase(),
    address: data.address.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updateCustomer(
  id: string,
  data: Partial<Omit<Customer, 'id'>>
): Promise<void> {
  const patch: DocumentData = { updatedAt: serverTimestamp() }
  if (data.name !== undefined) patch.name = data.name.trim()
  if (data.phone !== undefined) patch.phone = normalizePhone(data.phone)
  if (data.email !== undefined) patch.email = data.email.trim().toLowerCase()
  if (data.address !== undefined) patch.address = data.address.trim()
  await updateDoc(doc(db, COL.customers, id), patch)
}

/**
 * Deletes a customer together with every vehicle and service record that
 * belongs to them, so no orphan documents are left behind.
 */
export async function deleteCustomerCascade(customerId: string): Promise<{
  vehicles: number
  services: number
}> {
  const vSnap = await getDocs(
    query(collection(db, COL.vehicles), where('customerId', '==', customerId))
  )
  const sSnap = await getDocs(
    query(collection(db, COL.services), where('customerId', '==', customerId))
  )

  const batch = writeBatch(db)
  vSnap.docs.forEach((d) => batch.delete(d.ref))
  sSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, COL.customers, customerId))
  await batch.commit()

  return { vehicles: vSnap.size, services: sSnap.size }
}

/* --------------------------------- vehicles -------------------------------- */

/** Duplicate-registration guard, executed against Firestore (not local state). */
export async function isRegistrationTaken(
  registrationNumber: string,
  ignoreVehicleId?: string
): Promise<boolean> {
  const key = normalizeReg(registrationNumber)
  if (!key) return false
  const snap = await getDocs(
    query(collection(db, COL.vehicles), where('registrationKey', '==', key))
  )
  return snap.docs.some((d) => d.id !== ignoreVehicleId)
}

export async function addVehicle(
  data: Omit<
    Vehicle,
    | 'id' | 'createdAt' | 'updatedAt' | 'registrationKey'
    | 'lastServiceDate' | 'lastServiceMileage'
    | 'nextServiceDate' | 'nextServiceMileage' | 'predictionStatus'
  >
): Promise<string> {
  const key = normalizeReg(data.registrationNumber)
  if (await isRegistrationTaken(data.registrationNumber)) {
    throw new Error(`Registration number "${data.registrationNumber.trim()}" is already registered.`)
  }

  // A brand-new vehicle has no history: engine reports NO_DATA.
  const pred = predictNextService(
    {
      vehicleType: data.vehicleType,
      currentMileage: data.currentMileage,
      lastServiceDate: null,
      lastServiceMileage: null
    },
    []
  )

  const ref = await addDoc(collection(db, COL.vehicles), {
    customerId: data.customerId,
    registrationNumber: data.registrationNumber.trim().toUpperCase(),
    registrationKey: key,
    brand: data.brand.trim(),
    model: data.model.trim(),
    year: data.year,
    vehicleType: data.vehicleType,
    currentMileage: data.currentMileage,
    lastServiceDate: null,
    lastServiceMileage: null,
    nextServiceDate: pred.predictedDate,
    nextServiceMileage: pred.predictedMileage,
    predictionStatus: pred.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updateVehicle(
  id: string,
  data: Partial<Omit<Vehicle, 'id'>>
): Promise<void> {
  const patch: DocumentData = { updatedAt: serverTimestamp() }
  if (data.registrationNumber !== undefined) {
    if (await isRegistrationTaken(data.registrationNumber, id)) {
      throw new Error(
        `Registration number "${data.registrationNumber.trim()}" is already registered to another vehicle.`
      )
    }
    patch.registrationNumber = data.registrationNumber.trim().toUpperCase()
    patch.registrationKey = normalizeReg(data.registrationNumber)
  }
  for (const k of ['customerId', 'brand', 'model', 'vehicleType'] as const) {
    if (data[k] !== undefined) patch[k] = typeof data[k] === 'string' ? String(data[k]).trim() : data[k]
  }
  if (data.year !== undefined) patch.year = data.year
  if (data.currentMileage !== undefined) patch.currentMileage = data.currentMileage
  await updateDoc(doc(db, COL.vehicles, id), patch)
  await recalculateVehiclePrediction(id)
}

export async function deleteVehicleCascade(vehicleId: string): Promise<{ services: number }> {
  const sSnap = await getDocs(
    query(collection(db, COL.services), where('vehicleId', '==', vehicleId))
  )
  const batch = writeBatch(db)
  sSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, COL.vehicles, vehicleId))
  await batch.commit()
  return { services: sSnap.size }
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const snap = await getDoc(doc(db, COL.vehicles, id))
  if (!snap.exists()) return null
  return mapVehicle(snap as QueryDocumentSnapshot<DocumentData>)
}

/** Odometer update — never allowed to go backwards. */
export async function updateMileage(vehicleId: string, mileage: number): Promise<void> {
  await updateDoc(doc(db, COL.vehicles, vehicleId), {
    currentMileage: mileage,
    updatedAt: serverTimestamp()
  })
  await recalculateVehiclePrediction(vehicleId)
}

/* ----------------------------- service records ----------------------------- */

export async function getVehicleServices(vehicleId: string): Promise<ServiceRecord[]> {
  const snap = await getDocs(
    query(collection(db, COL.services), where('vehicleId', '==', vehicleId))
  )
  return snap.docs
    .map(mapService)
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
}

/**
 * Single source of truth for derived vehicle fields. Reads the vehicle's full
 * service history from Firestore, runs the prediction engine, and writes back
 * lastService*, nextService* and predictionStatus.
 */
export async function recalculateVehiclePrediction(vehicleId: string): Promise<void> {
  const vehicle = await getVehicle(vehicleId)
  if (!vehicle) return
  const services = await getVehicleServices(vehicleId)

  // Newest service (services are sorted desc by date).
  const latest = services.length ? services[0] : null
  const highestMileage = services.reduce((m, s) => Math.max(m, s.mileage), 0)
  const currentMileage = Math.max(vehicle.currentMileage, highestMileage)

  const pred = predictNextService(
    {
      vehicleType: vehicle.vehicleType,
      currentMileage,
      lastServiceDate: latest?.serviceDate ?? null,
      lastServiceMileage: latest?.mileage ?? null
    },
    services
  )

  await updateDoc(doc(db, COL.vehicles, vehicleId), {
    currentMileage,
    lastServiceDate: latest?.serviceDate ?? null,
    lastServiceMileage: latest?.mileage ?? null,
    nextServiceDate: pred.predictedDate,
    nextServiceMileage: pred.predictedMileage,
    predictionStatus: pred.status,
    updatedAt: serverTimestamp()
  })
}

export async function addServiceRecord(
  data: Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL.services), {
    vehicleId: data.vehicleId,
    customerId: data.customerId,
    serviceDate: data.serviceDate,
    mileage: data.mileage,
    serviceType: data.serviceType,
    description: data.description.trim(),
    cost: data.cost,
    technician: data.technician.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  // Steps 2-4 of the spec: refresh last-service info, prediction and status.
  await recalculateVehiclePrediction(data.vehicleId)
  return ref.id
}

export async function updateServiceRecord(
  id: string,
  data: Partial<Omit<ServiceRecord, 'id'>>,
  vehicleIdForRecalc: string
): Promise<void> {
  const patch: DocumentData = { updatedAt: serverTimestamp() }
  for (const k of ['serviceDate', 'serviceType', 'technician', 'description', 'vehicleId', 'customerId'] as const) {
    if (data[k] !== undefined) patch[k] = String(data[k]).trim()
  }
  if (data.mileage !== undefined) patch.mileage = data.mileage
  if (data.cost !== undefined) patch.cost = data.cost
  await updateDoc(doc(db, COL.services, id), patch)

  await recalculateVehiclePrediction(vehicleIdForRecalc)
  if (data.vehicleId && data.vehicleId !== vehicleIdForRecalc) {
    await recalculateVehiclePrediction(data.vehicleId)
  }
}

export async function deleteServiceRecord(id: string, vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, COL.services, id))
  await recalculateVehiclePrediction(vehicleId)
}

export { toISODate }
