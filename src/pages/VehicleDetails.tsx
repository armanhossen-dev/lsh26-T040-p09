import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FullPageLoader,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  currency,
  formatDate,
  km,
  chartNum
} from '@/components/ui'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { deleteServiceRecord, updateMileage } from '@/lib/db'
import { friendlyError } from '@/lib/firebase'
import { STATUS_META } from '@/lib/prediction'
import { nonNegativeNumber, toNumber } from '@/lib/validation'
import type { ServiceRecord } from '@/types'

export default function VehicleDetails() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { vehicleById, loading, error } = useData()
  const toast = useToast()

  const [mileageOpen, setMileageOpen] = useState(false)
  const [mileageValue, setMileageValue] = useState('')
  const [mileageError, setMileageError] = useState<string>()
  const [savingMileage, setSavingMileage] = useState(false)
  const [toDelete, setToDelete] = useState<ServiceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const vehicle = vehicleById.get(id) ?? null

  /** Chronological (oldest first) series for the charts. */
  const series = useMemo(() => {
    if (!vehicle) return []
    return [...vehicle.services]
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
      .map((s) => ({
        label: formatDate(s.serviceDate).replace(/ \d{4}$/, ''),
        date: s.serviceDate,
        mileage: s.mileage,
        cost: s.cost,
        type: s.serviceType
      }))
  }, [vehicle])

  const totalSpend = vehicle?.services.reduce((a, s) => a + s.cost, 0) ?? 0

  async function saveMileage(ev: React.FormEvent) {
    ev.preventDefault()
    if (!vehicle) return
    const err = nonNegativeNumber(mileageValue, 'Mileage', { max: 2_000_000 })
    if (err) return setMileageError(err)
    const next = toNumber(mileageValue)
    if (next < vehicle.currentMileage) {
      return setMileageError(
        `Odometer cannot go backwards. Current reading is ${vehicle.currentMileage.toLocaleString()} km.`
      )
    }
    setMileageError(undefined)
    setSavingMileage(true)
    try {
      await updateMileage(vehicle.id, next)
      toast.success(`Mileage updated to ${next.toLocaleString()} km. Prediction recalculated.`)
      setMileageOpen(false)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSavingMileage(false)
    }
  }

  async function confirmDeleteService() {
    if (!toDelete || !vehicle) return
    setDeleting(true)
    try {
      await deleteServiceRecord(toDelete.id, vehicle.id)
      toast.success('Service record deleted. Prediction recalculated.')
      setToDelete(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setDeleting(false)
    }
  }

  if (error) return <ErrorState message={error} />
  if (loading) return <FullPageLoader label="Loading vehicle…" />

  if (!vehicle) {
    return (
      <div className="card">
        <EmptyState
          title="Vehicle not found"
          message="This vehicle may have been deleted, or the link is incorrect."
          action={
            <Link to="/vehicles" className="btn-primary">
              Back to vehicles
            </Link>
          }
        />
      </div>
    )
  }

  const p = vehicle.prediction
  const meta = STATUS_META[p.status]

  return (
    <div>
      <button onClick={() => nav('/vehicles')} className="btn-ghost mb-3 -ml-2 text-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to vehicles
      </button>

      <PageHeader
        title={vehicle.registrationNumber}
        subtitle={`${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${vehicle.vehicleType}`}
        actions={
          <>
            <button
              onClick={() => {
                setMileageValue(String(vehicle.currentMileage))
                setMileageError(undefined)
                setMileageOpen(true)
              }}
              className="btn-secondary"
            >
              Update mileage
            </button>
            <Link to={`/services?vehicle=${vehicle.id}`} className="btn-primary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add service record
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------ PREDICTION CARD ------------------------ */}
        <div className="card overflow-hidden lg:col-span-2">
          <div
            className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${
              p.status === 'OVERDUE'
                ? 'border-red-200 bg-red-50'
                : p.status === 'DUE_SOON'
                  ? 'border-amber-200 bg-amber-50'
                  : p.status === 'SAFE'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-steel-200 bg-steel-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-steel-700">
                Next Service
              </h3>
            </div>
            <StatusBadge status={p.status} />
          </div>

          <div className="grid grid-cols-2 divide-steel-100 sm:grid-cols-4 sm:divide-x">
            <Metric label="Estimated Date" value={formatDate(p.predictedDate)} />
            <Metric label="Estimated Mileage" value={km(p.predictedMileage)} />
            <Metric
              label="Days Remaining"
              value={
                p.daysRemaining === null
                  ? '—'
                  : p.daysRemaining < 0
                    ? `${Math.abs(p.daysRemaining)} late`
                    : String(p.daysRemaining)
              }
              tone={p.daysRemaining !== null && p.daysRemaining < 0 ? 'text-red-600' : undefined}
            />
            <Metric
              label="KM Remaining"
              value={
                p.kmRemaining === null
                  ? '—'
                  : p.kmRemaining < 0
                    ? `${Math.abs(p.kmRemaining).toLocaleString()} over`
                    : p.kmRemaining.toLocaleString()
              }
              tone={p.kmRemaining !== null && p.kmRemaining < 0 ? 'text-red-600' : undefined}
            />
          </div>

          {/* explanation */}
          <div className="border-t border-steel-100 bg-steel-50/60 px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-steel-500">
                Prediction explanation
              </span>
              <span
                className={`badge text-[10px] ${
                  p.confidence === 'HIGH'
                    ? 'bg-emerald-100 text-emerald-800'
                    : p.confidence === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-steel-200 text-steel-700'
                }`}
              >
                {p.confidence} CONFIDENCE
              </span>
              {p.basis !== 'NONE' && (
                <span className="badge bg-brand-50 text-[10px] text-brand-700">
                  BASIS: {p.basis === 'BOTH' ? 'MILEAGE + TIME' : p.basis}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-steel-700">{p.explanation}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat
                label="Avg km interval"
                value={p.avgKmInterval ? `${p.avgKmInterval.toLocaleString()} km` : 'Not measured'}
              />
              <MiniStat
                label="Avg time interval"
                value={p.avgDayInterval ? `${p.avgDayInterval} days` : 'Not measured'}
              />
              <MiniStat label="Intervals used" value={String(p.intervalsUsed)} />
              <MiniStat label="Service records" value={String(vehicle.services.length)} />
            </dl>

            <p className="mt-3 text-xs italic text-steel-500">
              Prediction is based on this vehicle&apos;s historical service intervals using a
              transparent statistical engine (mileage-based and time-based forecasts, whichever is
              more urgent). No machine-learning model or randomisation is involved.
            </p>
          </div>
        </div>

        {/* --------------------------- vehicle info --------------------------- */}
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-steel-900">Vehicle information</h3>
          <dl className="space-y-3.5 text-sm">
            <Row label="Registration" value={<span className="font-bold">{vehicle.registrationNumber}</span>} />
            <Row label="Brand & model" value={`${vehicle.brand} ${vehicle.model}`} />
            <Row label="Year" value={String(vehicle.year)} />
            <Row label="Type" value={vehicle.vehicleType} />
            <Row
              label="Current mileage"
              value={<span className="font-bold text-brand-700">{km(vehicle.currentMileage)}</span>}
            />
            <Row
              label="Owner"
              value={
                vehicle.customer ? (
                  <Link to={`/customers/${vehicle.customer.id}`} className="link">
                    {vehicle.customer.name}
                  </Link>
                ) : (
                  <span className="text-steel-400">Unassigned</span>
                )
              }
            />
            <Row label="Owner phone" value={vehicle.customer?.phone ?? '—'} />
            <Row
              label="Last service"
              value={
                vehicle.lastServiceDate
                  ? `${formatDate(vehicle.lastServiceDate)} · ${km(vehicle.lastServiceMileage)}`
                  : 'No service yet'
              }
            />
            <Row label="Total spent" value={<span className="font-bold text-emerald-600">{currency(totalSpend)}</span>} />
          </dl>
        </div>
      </div>

      {/* ------------------------------- charts ------------------------------- */}
      {series.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-bold text-steel-900">Mileage history</h3>
            <p className="mb-3 text-xs text-steel-500">Odometer reading at each recorded service</p>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={series} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#66768d' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#66768d' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  contentStyle={TOOLTIP}
                  formatter={(v) => [`${chartNum(v).toLocaleString()} km`, 'Mileage']}
                />
                <Line
                  type="monotone"
                  dataKey="mileage"
                  stroke="#1f43e0"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#1f43e0' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-steel-900">Cost history</h3>
            <p className="mb-3 text-xs text-steel-500">Amount charged per service (BDT)</p>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={series} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#66768d' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#66768d' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => [currency(chartNum(v)), 'Cost']} />
                <Bar dataKey="cost" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ------------------------- timeline + history ------------------------- */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-steel-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-steel-900">Service timeline ({vehicle.services.length})</h3>
            <p className="text-xs text-steel-500">Newest first · total {currency(totalSpend)}</p>
          </div>
          <Link to={`/services?vehicle=${vehicle.id}`} className="btn-secondary text-xs">
            Add service record
          </Link>
        </div>

        {vehicle.services.length === 0 ? (
          <EmptyState
            title="No service records yet"
            message="The prediction engine needs at least one service record. Add two or more to measure this vehicle's real service intervals."
            action={
              <Link to={`/services?vehicle=${vehicle.id}`} className="btn-primary">
                Log first service
              </Link>
            }
          />
        ) : (
          <ol className="relative px-5 py-5">
            <div className="absolute bottom-6 left-[2.35rem] top-8 w-px bg-steel-200" aria-hidden="true" />
            {vehicle.services.map((s, i) => (
              <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                    i === 0 ? 'bg-brand-600 text-white' : 'bg-steel-200 text-steel-600'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877m0 0a3.75 3.75 0 0 0-5.304-5.303 3.75 3.75 0 0 0-1.06 3.18l-3.94 3.94a3.75 3.75 0 0 0 5.303 5.303l3.94-3.94Z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1 rounded-xl border border-steel-200 bg-white p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-steel-900">{s.serviceType}</p>
                        {i === 0 && (
                          <span className="badge bg-brand-50 text-[10px] text-brand-700">LATEST</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-steel-500">
                        {formatDate(s.serviceDate)} · {km(s.mileage)}
                        {s.technician && ` · ${s.technician}`}
                      </p>
                      {s.description && (
                        <p className="mt-1.5 text-sm text-steel-600">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-emerald-600">{currency(s.cost)}</p>
                      <button
                        onClick={() => setToDelete(s)}
                        className="btn-ghost p-1.5 text-red-600 hover:bg-red-50"
                        title="Delete this record"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* update mileage modal */}
      <Modal
        open={mileageOpen}
        onClose={() => !savingMileage && setMileageOpen(false)}
        title="Update mileage"
        subtitle={`${vehicle.registrationNumber} · current ${km(vehicle.currentMileage)}`}
        size="sm"
      >
        <form onSubmit={saveMileage} className="space-y-4" noValidate>
          <Field
            label="New odometer reading (km)"
            error={mileageError}
            hint="Saving recalculates the prediction and status immediately."
            required
          >
            <input
              className={`input ${mileageError ? 'input-error' : ''}`}
              inputMode="numeric"
              value={mileageValue}
              onChange={(e) => setMileageValue(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setMileageOpen(false)} disabled={savingMileage}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={savingMileage}>
              {savingMileage && <Spinner className="h-4 w-4" />}
              {savingMileage ? 'Updating…' : 'Update mileage'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete service record?"
        busy={deleting}
        message={
          <>
            <p>
              The <strong>{toDelete?.serviceType}</strong> record from{' '}
              <strong>{formatDate(toDelete?.serviceDate)}</strong> will be deleted.
            </p>
            <p className="mt-2">
              The vehicle&apos;s last-service info and prediction will be recalculated automatically.
            </p>
          </>
        }
        onConfirm={confirmDeleteService}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

const TOOLTIP = {
  borderRadius: 10,
  border: '1px solid #d5dae2',
  fontSize: 12,
  boxShadow: '0 6px 20px rgba(34,39,46,.10)'
} as const

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-steel-400">{label}</p>
      <p className={`mt-1 text-lg font-extrabold sm:text-xl ${tone ?? 'text-steel-900'}`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-steel-200 bg-white px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-steel-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-steel-800">{value}</dd>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-steel-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-steel-800">{value}</dd>
    </div>
  )
}
