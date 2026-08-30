import type { PredictionStatus, ServiceRecord, Vehicle, VehicleType } from '@/types'

/**
 * ============================================================================
 *  SERVICE-DUE PREDICTION ENGINE  (transparent statistical model — not ML)
 * ============================================================================
 *  This is a deterministic, fully explainable rule/statistics engine. It does
 *  NOT use a trained machine-learning model, and nothing here is random.
 *
 *  It combines two independent forecasts and takes whichever comes first:
 *    1. MILEAGE-BASED : last service mileage + average km between services
 *    2. TIME-BASED    : last service date   + average days between services
 *
 *  When a vehicle has fewer than two service records there is no measured
 *  interval yet, so we fall back to a documented manufacturer-style default
 *  per vehicle type, and report lower confidence.
 * ============================================================================
 */

/** Manufacturer-style baseline intervals used until real history exists. */
export const DEFAULT_INTERVALS: Record<VehicleType, { km: number; days: number }> = {
  Sedan: { km: 5000, days: 180 },
  Hatchback: { km: 5000, days: 180 },
  SUV: { km: 7000, days: 180 },
  Microbus: { km: 7000, days: 150 },
  Pickup: { km: 8000, days: 150 },
  'CNG/Auto-rickshaw': { km: 4000, days: 90 },
  Motorcycle: { km: 3000, days: 120 },
  Truck: { km: 10000, days: 120 },
  Bus: { km: 12000, days: 90 }
}

export const FALLBACK_INTERVAL = { km: 5000, days: 180 }

/** Warning window: within this many km / days of due, status becomes DUE SOON. */
export const DUE_SOON_KM = 500
export const DUE_SOON_DAYS = 21

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PredictionResult {
  /** ISO yyyy-mm-dd of the predicted next service, or null if unknown. */
  predictedDate: string | null
  /** Odometer reading at which the next service is predicted to be needed. */
  predictedMileage: number | null
  /** Negative => overdue by that many days. */
  daysRemaining: number | null
  /** Negative => overdue by that many km. */
  kmRemaining: number | null
  status: PredictionStatus
  confidence: ConfidenceLevel
  /** Human-readable sentence shown in the UI. */
  explanation: string
  /** Which forecast triggered the status: the more urgent of the two. */
  basis: 'MILEAGE' | 'TIME' | 'BOTH' | 'NONE'
  /** Measured averages (null when derived from defaults). */
  avgKmInterval: number | null
  avgDayInterval: number | null
  /** Number of measured gaps between consecutive services. */
  intervalsUsed: number
  usedDefaults: boolean
}

/* ------------------------------- date helpers ------------------------------ */

/** Parse yyyy-mm-dd (or ISO) as a LOCAL date at midnight — avoids TZ drift. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfToday(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/** "about 5 months" / "about 3 weeks" — used inside explanations. */
export function humanizeDays(days: number): string {
  const d = Math.abs(Math.round(days))
  if (d < 14) return `${d} day${d === 1 ? '' : 's'}`
  if (d < 60) {
    const w = Math.round(d / 7)
    return `${w} week${w === 1 ? '' : 's'}`
  }
  const months = d / 30.44
  const rounded = months < 10 ? Math.round(months * 10) / 10 : Math.round(months)
  return `${rounded} month${rounded === 1 ? '' : 's'}`
}

/* ----------------------------- the core engine ----------------------------- */

/**
 * Predict the next service for a vehicle.
 * @param vehicle  vehicle with currentMileage / lastService* fields
 * @param records  that vehicle's service records (any order)
 * @param today    injectable "now" so results are testable & deterministic
 */
export function predictNextService(
  vehicle: Pick<
    Vehicle,
    'vehicleType' | 'currentMileage' | 'lastServiceDate' | 'lastServiceMileage'
  >,
  records: ServiceRecord[],
  today: Date = startOfToday()
): PredictionResult {
  // Chronological history, de-noised of unusable rows.
  const history = [...records]
    .filter((r) => parseDate(r.serviceDate) !== null && Number.isFinite(r.mileage))
    .sort((a, b) => {
      const t = parseDate(a.serviceDate)!.getTime() - parseDate(b.serviceDate)!.getTime()
      return t !== 0 ? t : a.mileage - b.mileage
    })

  const typeDefault = DEFAULT_INTERVALS[vehicle.vehicleType] ?? FALLBACK_INTERVAL

  // ---- No history at all: we cannot forecast, only advise a baseline. ----
  const lastFromVehicleDate = parseDate(vehicle.lastServiceDate)
  if (history.length === 0 && !lastFromVehicleDate) {
    return {
      predictedDate: null,
      predictedMileage: null,
      daysRemaining: null,
      kmRemaining: null,
      status: 'NO_DATA',
      confidence: 'LOW',
      basis: 'NONE',
      explanation:
        `No service history recorded yet, so no prediction can be made. ` +
        `Typical interval for a ${vehicle.vehicleType} is about ` +
        `${typeDefault.km.toLocaleString()} km or ${humanizeDays(typeDefault.days)}. ` +
        `Add this vehicle's first service record to start the prediction engine.`,
      avgKmInterval: null,
      avgDayInterval: null,
      intervalsUsed: 0,
      usedDefaults: true
    }
  }

  // ---- Anchor = most recent service (prefer real records over stored fields).
  const lastRecord = history.length ? history[history.length - 1] : null
  const lastDate = lastRecord ? parseDate(lastRecord.serviceDate)! : lastFromVehicleDate!
  const lastMileage = lastRecord
    ? lastRecord.mileage
    : Number.isFinite(vehicle.lastServiceMileage as number)
      ? (vehicle.lastServiceMileage as number)
      : null

  // ---- Measure real intervals between consecutive services. ----
  const kmGaps: number[] = []
  const dayGaps: number[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const cur = history[i]
    const km = cur.mileage - prev.mileage
    const days = diffDays(parseDate(cur.serviceDate)!, parseDate(prev.serviceDate)!)
    if (km > 0) kmGaps.push(km)
    if (days > 0) dayGaps.push(days)
  }

  const avgKm = kmGaps.length ? Math.round(kmGaps.reduce((a, b) => a + b, 0) / kmGaps.length) : null
  const avgDays = dayGaps.length
    ? Math.round(dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length)
    : null

  const kmInterval = avgKm ?? typeDefault.km
  const dayInterval = avgDays ?? typeDefault.days
  const usedDefaults = avgKm === null || avgDays === null
  const intervalsUsed = Math.max(kmGaps.length, dayGaps.length)

  // ---- 1) MILEAGE-BASED forecast ----
  const currentMileage = Number.isFinite(vehicle.currentMileage) ? vehicle.currentMileage : 0
  const baseMileage = lastMileage ?? currentMileage
  const predictedMileage = Math.round(baseMileage + kmInterval)
  const kmRemaining = predictedMileage - currentMileage

  // ---- 2) TIME-BASED forecast ----
  const predictedDateObj = addDays(lastDate, dayInterval)
  const daysRemaining = diffDays(predictedDateObj, today)

  // ---- Combine: whichever threshold is hit first is the operative one. ----
  const kmStatus = bucketFor(kmRemaining, DUE_SOON_KM)
  const timeStatus = bucketFor(daysRemaining, DUE_SOON_DAYS)
  const severity: Record<Exclude<PredictionStatus, 'NO_DATA'>, number> = {
    SAFE: 0,
    DUE_SOON: 1,
    OVERDUE: 2
  }
  const status: PredictionStatus =
    severity[kmStatus] >= severity[timeStatus] ? kmStatus : timeStatus

  let basis: PredictionResult['basis']
  if (kmStatus === timeStatus) basis = 'BOTH'
  else basis = severity[kmStatus] > severity[timeStatus] ? 'MILEAGE' : 'TIME'

  // ---- Confidence reflects how much real evidence we have. ----
  let confidence: ConfidenceLevel
  if (intervalsUsed >= 3 && !usedDefaults) confidence = 'HIGH'
  else if (intervalsUsed >= 1) confidence = 'MEDIUM'
  else confidence = 'LOW'

  return {
    predictedDate: toISODate(predictedDateObj),
    predictedMileage,
    daysRemaining,
    kmRemaining,
    status,
    confidence,
    basis,
    explanation: buildExplanation({
      recordCount: history.length,
      intervalsUsed,
      avgKm,
      avgDays,
      kmInterval,
      dayInterval,
      vehicleType: vehicle.vehicleType,
      status,
      basis,
      kmRemaining,
      daysRemaining,
      usedDefaults
    }),
    avgKmInterval: avgKm,
    avgDayInterval: avgDays,
    intervalsUsed,
    usedDefaults
  }
}

function bucketFor(remaining: number, threshold: number): Exclude<PredictionStatus, 'NO_DATA'> {
  if (remaining < 0) return 'OVERDUE'
  if (remaining <= threshold) return 'DUE_SOON'
  return 'SAFE'
}

function buildExplanation(a: {
  recordCount: number
  intervalsUsed: number
  avgKm: number | null
  avgDays: number | null
  kmInterval: number
  dayInterval: number
  vehicleType: VehicleType
  status: PredictionStatus
  basis: PredictionResult['basis']
  kmRemaining: number
  daysRemaining: number
  usedDefaults: boolean
}): string {
  const parts: string[] = []

  if (a.intervalsUsed > 0 && a.avgKm !== null && a.avgDays !== null) {
    parts.push(
      `Based on this vehicle's previous ${a.recordCount} service record${a.recordCount === 1 ? '' : 's'} ` +
        `(${a.intervalsUsed} measured interval${a.intervalsUsed === 1 ? '' : 's'}), ` +
        `the average service interval is ${a.avgKm.toLocaleString()} km and approximately ${humanizeDays(a.avgDays)}.`
    )
  } else if (a.intervalsUsed > 0) {
    const measured = a.avgKm !== null ? `${a.avgKm.toLocaleString()} km` : `${humanizeDays(a.avgDays!)}`
    parts.push(
      `Measured from ${a.recordCount} service record${a.recordCount === 1 ? '' : 's'}, this vehicle's ` +
        `average interval is ${measured}; the remaining figure uses the standard ` +
        `${a.vehicleType} interval.`
    )
  } else {
    parts.push(
      `Only one service record exists, so no interval has been measured yet. ` +
        `The prediction uses the standard ${a.vehicleType} interval of ` +
        `${a.kmInterval.toLocaleString()} km / ${humanizeDays(a.dayInterval)}.`
    )
  }

  // State which of the two forecasts is driving the status.
  if (a.status === 'OVERDUE') {
    const reasons: string[] = []
    if (a.kmRemaining < 0) reasons.push(`${Math.abs(a.kmRemaining).toLocaleString()} km past the predicted mileage`)
    if (a.daysRemaining < 0) reasons.push(`${Math.abs(a.daysRemaining)} day(s) past the predicted date`)
    parts.push(`This vehicle is OVERDUE — ${reasons.join(' and ')}.`)
  } else if (a.status === 'DUE_SOON') {
    const reasons: string[] = []
    if (a.kmRemaining >= 0 && a.kmRemaining <= DUE_SOON_KM)
      reasons.push(`only ${a.kmRemaining.toLocaleString()} km remaining`)
    if (a.daysRemaining >= 0 && a.daysRemaining <= DUE_SOON_DAYS)
      reasons.push(`${a.daysRemaining} day(s) remaining`)
    parts.push(`Service is DUE SOON — ${reasons.join(' and ')}.`)
  } else {
    parts.push(
      `The vehicle is within safe limits: ${a.kmRemaining.toLocaleString()} km and ` +
        `${a.daysRemaining} day(s) remaining before the next service.`
    )
  }

  parts.push(
    a.basis === 'BOTH'
      ? 'Both the mileage-based and time-based forecasts agree on this status.'
      : `The ${a.basis === 'MILEAGE' ? 'mileage-based' : 'time-based'} forecast is the more urgent of the two and determines the status.`
  )

  return parts.join(' ')
}

/* ------------------------------ presentation ------------------------------- */

export const STATUS_META: Record<
  PredictionStatus,
  { label: string; badge: string; dot: string; text: string; chart: string }
> = {
  SAFE: {
    label: 'Safe',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    chart: '#10b981'
  },
  DUE_SOON: {
    label: 'Due Soon',
    badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    chart: '#f59e0b'
  },
  OVERDUE: {
    label: 'Overdue',
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    dot: 'bg-red-500',
    text: 'text-red-700',
    chart: '#ef4444'
  },
  NO_DATA: {
    label: 'No Data',
    badge: 'bg-steel-100 text-steel-600 ring-1 ring-steel-200',
    dot: 'bg-steel-400',
    text: 'text-steel-600',
    chart: '#94a3b8'
  }
}

/** Sort key so the most urgent vehicles bubble to the top of tables. */
export function urgencyScore(p: PredictionResult): number {
  const base: Record<PredictionStatus, number> = {
    OVERDUE: 0,
    DUE_SOON: 1000,
    SAFE: 2000,
    NO_DATA: 3000
  }
  const d = p.daysRemaining ?? 9999
  return base[p.status] + Math.max(-999, Math.min(999, d))
}
