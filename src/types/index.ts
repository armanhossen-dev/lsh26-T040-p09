export type Role = 'admin' | 'staff'

export interface AppUser {
  uid: string
  name: string
  email: string
  role: Role
  createdAt?: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type VehicleType =
  | 'Sedan' | 'Hatchback' | 'SUV' | 'Microbus' | 'Pickup'
  | 'CNG/Auto-rickshaw' | 'Motorcycle' | 'Truck' | 'Bus'

export const VEHICLE_TYPES: VehicleType[] = [
  'Sedan', 'Hatchback', 'SUV', 'Microbus', 'Pickup',
  'CNG/Auto-rickshaw', 'Motorcycle', 'Truck', 'Bus'
]

/** Status buckets used across dashboard, tables and filters. */
export type PredictionStatus = 'SAFE' | 'DUE_SOON' | 'OVERDUE' | 'NO_DATA'

export interface Vehicle {
  id: string
  customerId: string
  registrationNumber: string
  registrationKey: string // normalized, used for duplicate detection
  brand: string
  model: string
  year: number
  vehicleType: VehicleType
  currentMileage: number
  lastServiceDate: string | null // ISO yyyy-mm-dd
  lastServiceMileage: number | null
  nextServiceDate: string | null
  nextServiceMileage: number | null
  predictionStatus: PredictionStatus
  createdAt?: string | null
  updatedAt?: string | null
}

export const SERVICE_TYPES = [
  'Full Service',
  'Oil & Filter Change',
  'Engine Tune-up',
  'Brake Service',
  'AC Service',
  'Transmission Service',
  'Tyre Replacement',
  'Battery Replacement',
  'Suspension Work',
  'Electrical Repair',
  'Body & Paint',
  'General Inspection'
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface ServiceRecord {
  id: string
  vehicleId: string
  customerId: string
  serviceDate: string // ISO yyyy-mm-dd
  mileage: number
  serviceType: string
  description: string
  cost: number
  technician: string
  createdAt?: string | null
  updatedAt?: string | null
}
