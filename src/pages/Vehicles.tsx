import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableSkeleton,
  formatDate,
  km
} from '@/components/ui'
import { useData, type VehicleWithMeta } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { addVehicle, deleteVehicleCascade, updateMileage, updateVehicle } from '@/lib/db'
import { friendlyError } from '@/lib/firebase'
import { nonNegativeNumber, required, toNumber, validYear } from '@/lib/validation'
import { VEHICLE_TYPES, type PredictionStatus, type VehicleType } from '@/types'

interface Form {
  customerId: string
  registrationNumber: string
  brand: string
  model: string
  year: string
  vehicleType: VehicleType
  currentMileage: string
}

const EMPTY: Form = {
  customerId: '',
  registrationNumber: '',
  brand: '',
  model: '',
  year: String(new Date().getFullYear()),
  vehicleType: 'Sedan',
  currentMileage: ''
}

type FilterKey = 'all' | 'SAFE' | 'DUE_SOON' | 'OVERDUE' | 'NO_DATA' | 'attention'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'SAFE', label: 'Safe' },
  { key: 'DUE_SOON', label: 'Due Soon' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'NO_DATA', label: 'No Data' }
]

export default function Vehicles() {
  const { customers, vehiclesWithMeta, loading, error } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleWithMeta | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)

  const [mileageTarget, setMileageTarget] = useState<VehicleWithMeta | null>(null)
  const [mileageValue, setMileageValue] = useState('')
  const [mileageError, setMileageError] = useState<string>()
  const [savingMileage, setSavingMileage] = useState(false)

  const [toDelete, setToDelete] = useState<VehicleWithMeta | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Deep links from the dashboard: /vehicles?filter=OVERDUE
  useEffect(() => {
    const f = params.get('filter')
    if (f && ['all', 'SAFE', 'DUE_SOON', 'OVERDUE', 'NO_DATA', 'attention'].includes(f)) {
      setFilter(f as FilterKey)
    }
  }, [params])

  const rows = useMemo(() => {
    let list = [...vehiclesWithMeta]
    const q = search.trim().toLowerCase()
    if (q) {
      const digits = q.replace(/\D/g, '')
      const regQ = q.replace(/[^a-z0-9\u0980-\u09FF]/g, '')
      list = list.filter(
        (v) =>
          (regQ.length > 0 && v.registrationKey.toLowerCase().includes(regQ)) ||
          v.brand.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.vehicleType.toLowerCase().includes(q) ||
          (v.customer?.name.toLowerCase().includes(q) ?? false) ||
          (digits.length >= 3 && (v.customer?.phone.replace(/\D/g, '').includes(digits) ?? false))
      )
    }
    if (filter === 'attention') {
      list = list.filter(
        (v) => v.prediction.status === 'OVERDUE' || v.prediction.status === 'DUE_SOON'
      )
    } else if (filter !== 'all') {
      list = list.filter((v) => v.prediction.status === (filter as PredictionStatus))
    }
    return list
  }, [vehiclesWithMeta, search, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vehiclesWithMeta.length }
    for (const f of ['SAFE', 'DUE_SOON', 'OVERDUE', 'NO_DATA']) {
      c[f] = vehiclesWithMeta.filter((v) => v.prediction.status === f).length
    }
    return c
  }, [vehiclesWithMeta])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY, customerId: customers[0]?.id ?? '' })
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(v: VehicleWithMeta) {
    setEditing(v)
    setForm({
      customerId: v.customerId,
      registrationNumber: v.registrationNumber,
      brand: v.brand,
      model: v.model,
      year: String(v.year),
      vehicleType: v.vehicleType,
      currentMileage: String(v.currentMileage)
    })
    setErrors({})
    setModalOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.customerId) e.customerId = 'Select the vehicle owner.'
    e.registrationNumber = required(form.registrationNumber, 'Registration number')
    e.brand = required(form.brand, 'Brand')
    e.model = required(form.model, 'Model')
    e.year = validYear(form.year)
    e.currentMileage = nonNegativeNumber(form.currentMileage, 'Current mileage', { max: 2_000_000 })

    // An odometer must never move backwards.
    if (editing && !e.currentMileage) {
      const next = toNumber(form.currentMileage)
      const lastServiceMileage = editing.lastServiceMileage
      if (lastServiceMileage !== null && next < lastServiceMileage) {
        e.currentMileage = `Cannot be lower than the last service mileage (${lastServiceMileage.toLocaleString()} km).`
      }
    }

    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as typeof e
    setErrors(clean)
    return Object.keys(clean).length === 0
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        customerId: form.customerId,
        registrationNumber: form.registrationNumber,
        brand: form.brand,
        model: form.model,
        year: toNumber(form.year),
        vehicleType: form.vehicleType,
        currentMileage: toNumber(form.currentMileage)
      }
      if (editing) {
        await updateVehicle(editing.id, payload)
        toast.success(`${payload.registrationNumber.toUpperCase()} updated.`)
      } else {
        await addVehicle(payload)
        toast.success(`Vehicle ${payload.registrationNumber.toUpperCase()} registered.`)
      }
      setModalOpen(false)
    } catch (err) {
      const msg = friendlyError(err)
      // Surface duplicate-registration rejection on the field itself.
      if (/already registered/i.test(msg)) setErrors({ registrationNumber: msg })
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function saveMileage(ev: React.FormEvent) {
    ev.preventDefault()
    if (!mileageTarget) return
    const err = nonNegativeNumber(mileageValue, 'Mileage', { max: 2_000_000 })
    if (err) {
      setMileageError(err)
      return
    }
    const next = toNumber(mileageValue)
    if (next < mileageTarget.currentMileage) {
      setMileageError(
        `Odometer cannot go backwards. Current reading is ${mileageTarget.currentMileage.toLocaleString()} km.`
      )
      return
    }
    setMileageError(undefined)
    setSavingMileage(true)
    try {
      await updateMileage(mileageTarget.id, next)
      toast.success(`Mileage updated to ${next.toLocaleString()} km. Prediction recalculated.`)
      setMileageTarget(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSavingMileage(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await deleteVehicleCascade(toDelete.id)
      toast.success(
        `${toDelete.registrationNumber} deleted` +
          (res.services ? ` with ${res.services} service record(s).` : '.')
      )
      setToDelete(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setDeleting(false)
    }
  }

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${vehiclesWithMeta.length} vehicle${vehiclesWithMeta.length === 1 ? '' : 's'} · statuses predicted from real service history`}
        actions={
          <button onClick={openAdd} className="btn-primary" disabled={customers.length === 0}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add vehicle
          </button>
        }
      />

      {customers.length === 0 && !loading && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-amber-900">
            You need at least one customer before registering a vehicle.{' '}
            <Link to="/customers" className="font-semibold underline">
              Add a customer first
            </Link>
            .
          </p>
        </div>
      )}

      {/* toolbar */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search registration number, customer name, phone, brand or model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key)
                setParams({}, { replace: true })
              }}
              className={`badge border transition ${
                filter === f.key
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-50'
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  filter === f.key ? 'bg-brand-800/40' : 'bg-steel-100'
                }`}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
          {filter === 'attention' && (
            <span className="badge border border-amber-300 bg-amber-100 text-amber-900">
              Needs attention ({rows.length})
            </span>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={vehiclesWithMeta.length === 0 ? 'No vehicles registered' : 'No matching vehicles'}
            message={
              vehiclesWithMeta.length === 0
                ? 'Register a vehicle to start tracking mileage and predicting service due dates.'
                : 'Adjust your search term or choose a different status filter.'
            }
            action={
              vehiclesWithMeta.length === 0 ? (
                customers.length > 0 ? (
                  <button onClick={openAdd} className="btn-primary">
                    Add your first vehicle
                  </button>
                ) : (
                  <Link to="/customers" className="btn-primary">
                    Add a customer first
                  </Link>
                )
              ) : (
                <button
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                    setParams({}, { replace: true })
                  }}
                  className="btn-secondary"
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="th">Registration</th>
                  <th className="th">Owner</th>
                  <th className="th">Mileage</th>
                  <th className="th">Last service</th>
                  <th className="th">Predicted next</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {rows.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-steel-50">
                    <td className="td">
                      <Link to={`/vehicles/${v.id}`} className="font-semibold text-brand-600 hover:underline">
                        {v.registrationNumber}
                      </Link>
                      <p className="text-xs text-steel-500">
                        {v.brand} {v.model} · {v.year}
                      </p>
                    </td>
                    <td className="td">
                      {v.customer ? (
                        <Link to={`/customers/${v.customer.id}`} className="hover:underline">
                          {v.customer.name}
                        </Link>
                      ) : (
                        <span className="text-steel-400">Unassigned</span>
                      )}
                      <p className="text-xs text-steel-500">{v.vehicleType}</p>
                    </td>
                    <td className="td whitespace-nowrap font-medium">{km(v.currentMileage)}</td>
                    <td className="td whitespace-nowrap">
                      {formatDate(v.lastServiceDate)}
                      <p className="text-xs text-steel-500">
                        {v.services.length} record{v.services.length === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="td whitespace-nowrap">
                      {formatDate(v.prediction.predictedDate)}
                      <p className="text-xs text-steel-500">{km(v.prediction.predictedMileage)}</p>
                    </td>
                    <td className="td">
                      <StatusBadge status={v.prediction.status} />
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setMileageTarget(v)
                            setMileageValue(String(v.currentMileage))
                            setMileageError(undefined)
                          }}
                          className="btn-ghost p-2"
                          title="Update mileage"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                          </svg>
                        </button>
                        <Link to={`/vehicles/${v.id}`} className="btn-ghost p-2" title="View details">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </Link>
                        <button onClick={() => openEdit(v)} className="btn-ghost p-2" title="Edit vehicle">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setToDelete(v)}
                          className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                          title="Delete vehicle"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* add / edit vehicle */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit vehicle' : 'Register new vehicle'}
        subtitle={
          editing
            ? `Updating ${editing.registrationNumber}`
            : 'Registration numbers must be unique across the workshop.'
        }
        size="lg"
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Customer (owner)" error={errors.customerId} required>
            <select
              className={`input ${errors.customerId ? 'input-error' : ''}`}
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Registration number"
              error={errors.registrationNumber}
              hint="e.g. DHAKA METRO GA 15-1234"
              required
            >
              <input
                className={`input uppercase ${errors.registrationNumber ? 'input-error' : ''}`}
                placeholder="DHAKA METRO GA 15-1234"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              />
            </Field>
            <Field label="Vehicle type" required>
              <select
                className="input"
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value as VehicleType })}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Brand" error={errors.brand} required>
              <input
                className={`input ${errors.brand ? 'input-error' : ''}`}
                placeholder="Toyota"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </Field>
            <Field label="Model" error={errors.model} required>
              <input
                className={`input ${errors.model ? 'input-error' : ''}`}
                placeholder="Corolla X"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </Field>
            <Field label="Year" error={errors.year} required>
              <input
                className={`input ${errors.year ? 'input-error' : ''}`}
                inputMode="numeric"
                placeholder="2018"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Current mileage (km)"
            error={errors.currentMileage}
            hint="Odometer reading today — used for the mileage-based forecast."
            required
          >
            <input
              className={`input ${errors.currentMileage ? 'input-error' : ''}`}
              inputMode="numeric"
              placeholder="45000"
              value={form.currentMileage}
              onChange={(e) => setForm({ ...form, currentMileage: e.target.value })}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* update mileage */}
      <Modal
        open={!!mileageTarget}
        onClose={() => !savingMileage && setMileageTarget(null)}
        title="Update mileage"
        subtitle={mileageTarget ? `${mileageTarget.registrationNumber} · ${mileageTarget.brand} ${mileageTarget.model}` : ''}
        size="sm"
      >
        <form onSubmit={saveMileage} className="space-y-4" noValidate>
          <div className="rounded-lg bg-steel-50 px-3 py-2.5 text-sm">
            <p className="text-steel-500">Current reading</p>
            <p className="text-lg font-bold text-steel-900">{km(mileageTarget?.currentMileage ?? 0)}</p>
          </div>
          <Field
            label="New odometer reading (km)"
            error={mileageError}
            hint="The prediction is recalculated immediately after saving."
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMileageTarget(null)}
              disabled={savingMileage}
            >
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
        title="Delete vehicle?"
        busy={deleting}
        message={
          <>
            <p>
              <strong>{toDelete?.registrationNumber}</strong> ({toDelete?.brand} {toDelete?.model})
              will be permanently deleted.
            </p>
            {(toDelete?.services.length ?? 0) > 0 && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                Its <strong>{toDelete?.services.length} service record(s)</strong> will also be deleted.
              </p>
            )}
            <p className="mt-2">This action cannot be undone.</p>
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
