import { describe, expect, it } from 'vitest'
import { predictNextService, humanizeDays, DUE_SOON_KM } from './prediction'
import { isPhone, isEmail, normalizeReg, validYear, nonNegativeNumber } from './validation'
import type { ServiceRecord } from '@/types'

function rec(date: string, mileage: number, cost = 5000): ServiceRecord {
  return {
    id: Math.random().toString(36).slice(2),
    vehicleId: 'v1',
    customerId: 'c1',
    serviceDate: date,
    mileage,
    serviceType: 'Full Service',
    description: '',
    cost,
    technician: 'Rahim'
  }
}

const D = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('prediction engine — no data', () => {
  it('returns NO_DATA when there is no history', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 10_000, lastServiceDate: null, lastServiceMileage: null },
      []
    )
    expect(p.status).toBe('NO_DATA')
    expect(p.predictedDate).toBeNull()
    expect(p.confidence).toBe('LOW')
    expect(p.explanation).toMatch(/No service history/i)
  })
})

describe('prediction engine — mileage based (spec example)', () => {
  it('flags overdue by ~3,000 km for 10k→15k history at 18k current', () => {
    // Interval = 5,000 km. Last service 15,000. Current 18,000 => overdue 2,000... 
    // spec: previous 10,000 / next 15,000 => predicted next = 20,000
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 18_000, lastServiceDate: '2026-01-10', lastServiceMileage: 15_000 },
      [rec('2025-08-10', 10_000), rec('2026-01-10', 15_000)],
      D('2026-08-30')
    )
    expect(p.avgKmInterval).toBe(5_000)
    expect(p.predictedMileage).toBe(20_000)
    expect(p.kmRemaining).toBe(2_000)
    // Time-based: ~153 day interval from 2026-01-10 => ~2026-06-12, well past today
    expect(p.daysRemaining!).toBeLessThan(0)
    expect(p.status).toBe('OVERDUE')
    expect(p.basis).toBe('TIME')
  })

  it('detects mileage overdue even when the date is still in the future', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 21_000, lastServiceDate: '2026-08-01', lastServiceMileage: 15_000 },
      [rec('2026-03-01', 10_000), rec('2026-08-01', 15_000)],
      D('2026-08-30')
    )
    expect(p.kmRemaining).toBe(-1_000) // predicted 20,000, current 21,000
    expect(p.daysRemaining!).toBeGreaterThan(0)
    expect(p.status).toBe('OVERDUE')
    expect(p.basis).toBe('MILEAGE')
    expect(p.explanation).toMatch(/1,000 km past/)
  })
})

describe('prediction engine — time based (spec example)', () => {
  it('predicts ~5 months after last service', () => {
    // Two prior gaps of ~5 months each; last service 2026-01-10
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 30_000, lastServiceDate: '2026-01-10', lastServiceMileage: 30_000 },
      [rec('2025-03-10', 20_000), rec('2025-08-10', 25_000), rec('2026-01-10', 30_000)],
      D('2026-02-01')
    )
    // avg gap = (153 + 153)/2 = 153 days => 2026-06-12
    expect(p.avgDayInterval).toBe(153)
    expect(p.predictedDate).toBe('2026-06-12')
    expect(humanizeDays(p.avgDayInterval!)).toMatch(/month/)
    expect(p.status).toBe('SAFE')
  })
})

describe('prediction engine — statuses', () => {
  it('DUE SOON when within the km warning window', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 19_800, lastServiceDate: '2026-08-20', lastServiceMileage: 15_000 },
      [rec('2026-03-20', 10_000), rec('2026-08-20', 15_000)],
      D('2026-08-30')
    )
    expect(p.kmRemaining).toBe(200)
    expect(p.kmRemaining).toBeLessThanOrEqual(DUE_SOON_KM)
    expect(p.status).toBe('DUE_SOON')
  })

  it('DUE SOON when within the day warning window', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 15_100, lastServiceDate: '2026-03-31', lastServiceMileage: 15_000 },
      [rec('2025-10-29', 10_000), rec('2026-03-31', 15_000)],
      D('2026-08-25')
    )
    expect(p.daysRemaining!).toBeGreaterThanOrEqual(0)
    expect(p.daysRemaining!).toBeLessThanOrEqual(21)
    expect(p.status).toBe('DUE_SOON')
    expect(p.basis).toBe('TIME')
  })

  it('SAFE when both forecasts are comfortably ahead', () => {
    const p = predictNextService(
      { vehicleType: 'SUV', currentMileage: 15_200, lastServiceDate: '2026-08-20', lastServiceMileage: 15_000 },
      [rec('2026-02-20', 8_000), rec('2026-08-20', 15_000)],
      D('2026-08-30')
    )
    expect(p.status).toBe('SAFE')
    expect(p.basis).toBe('BOTH')
  })
})

describe('prediction engine — confidence & defaults', () => {
  it('LOW confidence + type default with a single record', () => {
    const p = predictNextService(
      { vehicleType: 'Motorcycle', currentMileage: 5_000, lastServiceDate: '2026-08-01', lastServiceMileage: 5_000 },
      [rec('2026-08-01', 5_000)],
      D('2026-08-30')
    )
    expect(p.confidence).toBe('LOW')
    expect(p.usedDefaults).toBe(true)
    expect(p.predictedMileage).toBe(8_000) // 5,000 + 3,000 motorcycle default
    expect(p.explanation).toMatch(/standard Motorcycle interval/)
  })

  it('HIGH confidence with 4 records (3 measured intervals)', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 26_000, lastServiceDate: '2026-07-01', lastServiceMileage: 25_000 },
      [rec('2025-01-01', 10_000), rec('2025-07-01', 15_000), rec('2026-01-01', 20_000), rec('2026-07-01', 25_000)],
      D('2026-08-30')
    )
    expect(p.intervalsUsed).toBe(3)
    expect(p.confidence).toBe('HIGH')
    expect(p.avgKmInterval).toBe(5_000)
    expect(p.explanation).toMatch(/previous 4 service records/)
    expect(p.explanation).toMatch(/average service interval is 5,000 km/)
  })

  it('is deterministic — same input gives same output', () => {
    const args = [
      { vehicleType: 'Sedan' as const, currentMileage: 18_000, lastServiceDate: '2026-01-10', lastServiceMileage: 15_000 },
      [rec('2025-08-10', 10_000), rec('2026-01-10', 15_000)],
      D('2026-08-30')
    ] as const
    const a = predictNextService(args[0], [...args[1]], args[2])
    const b = predictNextService(args[0], [...args[1]], args[2])
    expect(a).toEqual(b)
  })

  it('reacts to a mileage change (prediction updates when mileage changes)', () => {
    const history = [rec('2026-03-01', 10_000), rec('2026-08-01', 15_000)]
    const base = { vehicleType: 'Sedan' as const, lastServiceDate: '2026-08-01', lastServiceMileage: 15_000 }
    const low = predictNextService({ ...base, currentMileage: 16_000 }, history, D('2026-08-30'))
    const high = predictNextService({ ...base, currentMileage: 19_900 }, history, D('2026-08-30'))
    expect(low.status).toBe('SAFE')
    expect(high.status).toBe('DUE_SOON')
    expect(high.kmRemaining).toBeLessThan(low.kmRemaining!)
  })

  it('handles unordered input records', () => {
    const p = predictNextService(
      { vehicleType: 'Sedan', currentMileage: 26_000, lastServiceDate: null, lastServiceMileage: null },
      [rec('2026-07-01', 25_000), rec('2025-01-01', 10_000), rec('2026-01-01', 20_000), rec('2025-07-01', 15_000)],
      D('2026-08-30')
    )
    expect(p.avgKmInterval).toBe(5_000)
    expect(p.predictedMileage).toBe(30_000)
  })
})

describe('validation', () => {
  it('accepts valid BD phone numbers', () => {
    expect(isPhone('01712345678')).toBe(true)
    expect(isPhone('+8801912345678')).toBe(true)
    expect(isPhone('01512-345678')).toBe(true)
    expect(isPhone('029612345')).toBe(true)
  })
  it('rejects invalid phone numbers', () => {
    expect(isPhone('123')).toBe(false)
    expect(isPhone('0171234567')).toBe(false) // too short
    expect(isPhone('abcdefghijk')).toBe(false)
  })
  it('validates email', () => {
    expect(isEmail('a@b.com')).toBe(true)
    expect(isEmail('bad@')).toBe(false)
    expect(isEmail('no-at.com')).toBe(false)
  })
  it('normalizes registration numbers for duplicate checks', () => {
    expect(normalizeReg('dhaka metro-ga 15-1234')).toBe('DHAKAMETROGA151234')
    expect(normalizeReg(' Dhaka Metro GA 15 1234 ')).toBe(normalizeReg('dhaka-metro-ga-15-1234'))
  })
  it('rejects negative mileage and zero cost where required', () => {
    expect(nonNegativeNumber(-5, 'Mileage')).toMatch(/cannot be negative/)
    expect(nonNegativeNumber(0, 'Cost', { allowZero: false })).toMatch(/greater than zero/)
    expect(nonNegativeNumber(1200, 'Cost', { allowZero: false })).toBeUndefined()
  })
  it('validates year range', () => {
    expect(validYear(1900)).toMatch(/between/)
    expect(validYear(2020)).toBeUndefined()
  })
})
