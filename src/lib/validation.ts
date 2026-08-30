/** Reusable field validators. Every form runs through these before Firestore. */

export type Errors<T> = Partial<Record<keyof T, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

/**
 * Bangladeshi mobile numbers: 01XXXXXXXXX (11 digits), optionally +880 / 880
 * prefixed. Also accepts Dhaka landlines (02 + 7-8 digits).
 */
export function isPhone(v: string): boolean {
  const digits = v.replace(/[\s\-().]/g, '')
  // Mobile: 01XXXXXXXXX, or +880/880 followed by 1XXXXXXXXX
  if (/^01[3-9]\d{8}$/.test(digits)) return true
  if (/^\+?8801[3-9]\d{8}$/.test(digits)) return true
  // Dhaka landline: 02XXXXXXX(X), or +880 2XXXXXXX(X)
  if (/^02\d{7,8}$/.test(digits)) return true
  if (/^\+?8802?\d{7,8}$/.test(digits)) return true
  return false
}

export function normalizePhone(v: string): string {
  const digits = v.replace(/[^\d+]/g, '')
  if (/^\+?8801[3-9]\d{8}$/.test(digits)) return '0' + digits.slice(-10)
  return digits
}

/** Registration numbers are compared case/spacing-insensitively. */
export function normalizeReg(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9\u0980-\u09FF]/g, '')
}

export function isValidDateString(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function isNotFuture(v: string): boolean {
  if (!isValidDateString(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const now = new Date()
  return dt.getTime() <= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

export function toNumber(v: string | number): number {
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : NaN
}

export function required(v: string | undefined | null, label: string): string | undefined {
  return v && v.trim().length > 0 ? undefined : `${label} is required.`
}

export function nonNegativeNumber(
  raw: string | number,
  label: string,
  opts: { allowZero?: boolean; max?: number } = {}
): string | undefined {
  const { allowZero = true, max } = opts
  const s = String(raw).trim()
  if (s === '') return `${label} is required.`
  const n = toNumber(raw)
  if (Number.isNaN(n)) return `${label} must be a number.`
  if (n < 0) return `${label} cannot be negative.`
  if (!allowZero && n === 0) return `${label} must be greater than zero.`
  if (max !== undefined && n > max) return `${label} looks too large (max ${max.toLocaleString()}).`
  return undefined
}

export function validYear(raw: string | number): string | undefined {
  const n = toNumber(raw)
  const maxYear = new Date().getFullYear() + 1
  if (Number.isNaN(n)) return 'Year must be a number.'
  if (!Number.isInteger(n)) return 'Year must be a whole number.'
  if (n < 1950 || n > maxYear) return `Year must be between 1950 and ${maxYear}.`
  return undefined
}

export function hasErrors<T>(e: Errors<T>): boolean {
  return Object.values(e).some(Boolean)
}
