import { useState } from 'react'
import { Field, PageHeader, Spinner, currency, formatDate } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { projectId } from '@/lib/firebase'
import {
  DEFAULT_INTERVALS,
  DUE_SOON_DAYS,
  DUE_SOON_KM,
  humanizeDays
} from '@/lib/prediction'
import { VEHICLE_TYPES } from '@/types'

export default function Settings() {
  const { profile, changeName, changePassword, hasPasswordCredential } = useAuth()
  const { customers, vehiclesWithMeta, services } = useData()
  const toast = useToast()

  const [name, setName] = useState(profile?.name ?? '')
  const [nameErr, setNameErr] = useState<string>()
  const [savingName, setSavingName] = useState(false)

  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwErr, setPwErr] = useState<{ next?: string; confirm?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  const totalRevenue = services.reduce((a, s) => a + s.cost, 0)

  async function saveName(ev: React.FormEvent) {
    ev.preventDefault()
    if (!name.trim()) return setNameErr('Name is required.')
    if (name.trim().length < 2) return setNameErr('Name must be at least 2 characters.')
    setNameErr(undefined)
    setSavingName(true)
    try {
      await changeName(name)
      toast.success('Your name has been updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword(ev: React.FormEvent) {
    ev.preventDefault()
    const e: typeof pwErr = {}
    if (!pw.next) e.next = 'New password is required.'
    else if (pw.next.length < 6) e.next = 'Password must be at least 6 characters.'
    if (pw.confirm !== pw.next) e.confirm = 'Passwords do not match.'
    setPwErr(e)
    if (Object.keys(e).length) return

    setSavingPw(true)
    try {
      await changePassword(pw.next)
      toast.success('Password changed successfully.')
      setPw({ next: '', confirm: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password change failed.')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account, workshop data summary and prediction engine reference." />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* profile */}
        <div className="card p-5">
          <h3 className="font-bold text-steel-900">Your profile</h3>
          <p className="mb-4 text-xs text-steel-500">Stored in the Firestore `users` collection.</p>
          <form onSubmit={saveName} className="space-y-4">
            <Field label="Display name" error={nameErr} required>
              <input
                className={`input ${nameErr ? 'input-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email address" hint="Email cannot be changed after registration.">
              <input className="input" value={profile?.email ?? ''} disabled />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role">
                <input className="input capitalize" value={profile?.role ?? 'staff'} disabled />
              </Field>
              <Field label="Member since">
                <input className="input" value={formatDate(profile?.createdAt)} disabled />
              </Field>
            </div>
            <button type="submit" className="btn-primary" disabled={savingName}>
              {savingName && <Spinner className="h-4 w-4" />}
              {savingName ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>

        {/* password */}
        <div className="card p-5">
          <h3 className="font-bold text-steel-900">Change password</h3>
          {!hasPasswordCredential ? (
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.9}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <div className="text-sm text-brand-900">
                <p className="font-semibold">You signed in with Google</p>
                <p className="mt-0.5 text-brand-800">
                  This account has no password to change. Manage security from your{' '}
                  <a
                    className="link"
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Account settings
                  </a>
                  .
                </p>
              </div>
            </div>
          ) : (
          <>
          <p className="mb-4 text-xs text-steel-500">
            If you have been signed in a long time, Firebase may ask you to sign in again first.
          </p>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="New password" error={pwErr.next} hint="At least 6 characters." required>
              <input
                type="password"
                autoComplete="new-password"
                className={`input ${pwErr.next ? 'input-error' : ''}`}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password" error={pwErr.confirm} required>
              <input
                type="password"
                autoComplete="new-password"
                className={`input ${pwErr.confirm ? 'input-error' : ''}`}
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </Field>
            <button type="submit" className="btn-primary" disabled={savingPw}>
              {savingPw && <Spinner className="h-4 w-4" />}
              {savingPw ? 'Updating…' : 'Change password'}
            </button>
          </form>
          </>
          )}
        </div>
      </div>

      {/* data summary */}
      <div className="card mt-4 p-5">
        <h3 className="font-bold text-steel-900">Workshop data summary</h3>
        <p className="mb-4 text-xs text-steel-500">Live counts read from Firestore.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Customers" value={String(customers.length)} />
          <Stat label="Vehicles" value={String(vehiclesWithMeta.length)} />
          <Stat label="Service records" value={String(services.length)} />
          <Stat label="Lifetime revenue" value={currency(totalRevenue)} accent="text-emerald-600" />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-steel-200 px-3.5 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-steel-400">Firebase project</dt>
            <dd className="mt-0.5 font-mono text-xs font-semibold text-steel-800">{projectId}</dd>
          </div>
          <div className="rounded-lg border border-steel-200 px-3.5 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-steel-400">Collections in use</dt>
            <dd className="mt-0.5 font-mono text-xs font-semibold text-steel-800">
              users · customers · vehicles · serviceRecords
            </dd>
          </div>
        </dl>
      </div>

      {/* engine reference */}
      <div className="card mt-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-steel-900">Prediction engine reference</h3>
          <span className="badge bg-brand-50 text-[10px] text-brand-700">
            STATISTICAL ENGINE · NOT MACHINE LEARNING
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-steel-600">
          The engine measures the average kilometres and average number of days between a
          vehicle&apos;s consecutive service records, then projects both forward from its last
          service and uses whichever threshold is reached first. Nothing is randomised, and every
          forecast is reproducible from the records you can see. Until a vehicle has two records,
          the intervals below are used as a documented starting point and confidence is reported as
          LOW.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              &quot;Due soon&quot; warning window
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              Within {DUE_SOON_KM.toLocaleString()} km or {DUE_SOON_DAYS} days of the forecast
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">
              &quot;Overdue&quot; condition
            </p>
            <p className="mt-1 text-sm font-semibold text-red-900">
              Past the predicted date or past the predicted mileage
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="th">Vehicle type</th>
                <th className="th">Default km interval</th>
                <th className="th">Default time interval</th>
                <th className="th">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {VEHICLE_TYPES.map((t) => (
                <tr key={t}>
                  <td className="td font-medium">{t}</td>
                  <td className="td">{DEFAULT_INTERVALS[t].km.toLocaleString()} km</td>
                  <td className="td">
                    {DEFAULT_INTERVALS[t].days} days ({humanizeDays(DEFAULT_INTERVALS[t].days)})
                  </td>
                  <td className="td">{vehiclesWithMeta.filter((v) => v.vehicleType === t).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg bg-steel-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">
            Confidence levels
          </p>
          <ul className="mt-2 space-y-1 text-sm text-steel-600">
            <li>
              <strong className="text-emerald-700">HIGH</strong> — 3 or more measured intervals
              (4+ service records) with both km and time measured.
            </li>
            <li>
              <strong className="text-amber-700">MEDIUM</strong> — 1 or 2 measured intervals.
            </li>
            <li>
              <strong className="text-steel-700">LOW</strong> — no measured interval yet; the default
              interval for the vehicle type is used.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-steel-200 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${accent ?? 'text-steel-900'}`}>{value}</p>
    </div>
  )
}
