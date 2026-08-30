import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { subscribeCustomers, subscribeServices, subscribeVehicles } from '@/lib/db'
import { friendlyError } from '@/lib/firebase'
import { predictNextService, urgencyScore, type PredictionResult } from '@/lib/prediction'
import { useAuth } from './AuthContext'
import type { Customer, ServiceRecord, Vehicle } from '@/types'

export interface VehicleWithMeta extends Vehicle {
  customer: Customer | null
  services: ServiceRecord[]
  prediction: PredictionResult
}

interface DataApi {
  customers: Customer[]
  vehicles: Vehicle[]
  services: ServiceRecord[]
  /** Vehicles joined with their customer + history and a live prediction. */
  vehiclesWithMeta: VehicleWithMeta[]
  loading: boolean
  error: string | null
  customerById: Map<string, Customer>
  vehicleById: Map<string, VehicleWithMeta>
  servicesByVehicle: Map<string, ServiceRecord[]>
}

const DataContext = createContext<DataApi | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [ready, setReady] = useState({ c: false, v: false, s: false })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setCustomers([])
      setVehicles([])
      setServices([])
      setReady({ c: false, v: false, s: false })
      return
    }
    setError(null)
    const onErr = (e: unknown) => setError(friendlyError(e))

    const u1 = subscribeCustomers((rows) => {
      setCustomers(rows)
      setReady((r) => ({ ...r, c: true }))
    }, onErr)
    const u2 = subscribeVehicles((rows) => {
      setVehicles(rows)
      setReady((r) => ({ ...r, v: true }))
    }, onErr)
    const u3 = subscribeServices((rows) => {
      setServices(rows)
      setReady((r) => ({ ...r, s: true }))
    }, onErr)

    return () => {
      u1()
      u2()
      u3()
    }
  }, [user])

  const value = useMemo<DataApi>(() => {
    const customerById = new Map(customers.map((c) => [c.id, c]))

    const servicesByVehicle = new Map<string, ServiceRecord[]>()
    for (const s of services) {
      const arr = servicesByVehicle.get(s.vehicleId)
      if (arr) arr.push(s)
      else servicesByVehicle.set(s.vehicleId, [s])
    }
    for (const arr of servicesByVehicle.values()) {
      arr.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
    }

    const vehiclesWithMeta: VehicleWithMeta[] = vehicles
      .map((v) => {
        const vs = servicesByVehicle.get(v.id) ?? []
        // Recompute client-side so the UI is always consistent with the engine,
        // even if a stored field is stale.
        const prediction = predictNextService(v, vs)
        return { ...v, customer: customerById.get(v.customerId) ?? null, services: vs, prediction }
      })
      .sort((a, b) => urgencyScore(a.prediction) - urgencyScore(b.prediction))

    return {
      customers,
      vehicles,
      services,
      vehiclesWithMeta,
      loading: !(ready.c && ready.v && ready.s),
      error,
      customerById,
      vehicleById: new Map(vehiclesWithMeta.map((v) => [v.id, v])),
      servicesByVehicle
    }
  }, [customers, vehicles, services, ready, error])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataApi {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
