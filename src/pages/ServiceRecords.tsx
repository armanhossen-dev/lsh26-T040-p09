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
  TableSkeleton,
  currency,
  formatDate,
  km
} from '@/components/ui'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { addServiceRecord, deleteServiceRecord, updateServiceRecord } from '@/lib/db'
import { friendlyError } from '@/lib/firebase'
import { toISODate } from '@/lib/prediction'
import { isNotFuture, isValidDateString, nonNegativeNumber, required, toNumber } from '@/lib/validation'
import { SERVICE_TYPES, type ServiceRecord } from '@/types'

interface Form {
  vehicleId: string
  serviceDate: string
  mileage: string
  serviceType: string
  description: string
  cost: string
  technician: string
}

const emptyForm = (): Form => ({
  vehicleId: '',
  serviceDate: toISODate(new Date()),
  mileage: '',
  serviceType: 'Full Service',
  description: '',
  cost: '',
  technician: ''
})

export default function ServiceRecords() {
  const { services, vehiclesWithMeta, vehicleById, loading, error } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [vehicleFilter, setVehicleFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRecord | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)

  const [toDelete, setToDelete] = useState<ServiceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Deep link from a vehicle page: /services?vehicle=<id> opens the add form.
  useEffect(() => {
    const vid = params.get('vehicle')
    if (vid && vehicleById.has(vid)) {
      const v = vehicleById.get(vid)!
      setEditing(null)
      setForm({ ...emptyForm(), vehicleId: vid, mileage: String(v.currentMileage) })
      setErrors({})
      setModalOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, vehicleById, setParams])

  const rows = useMemo(() => {
    let list = services.map((s) => ({ ...s, vehicle: vehicleById.get(s.vehicleId) ?? null }))
    const q = search.trim().toLowerCase()
    if (q) {
      const regQ = q.replace(/[^a-z0-9\u0980-\u09FF]/g, '')
      list = list.filter(
        (s) =>
          (regQ.length > 0 && (s.vehicle?.registrationKey.toLowerCase().includes(regQ) ?? false)) ||
          (s.vehicle?.customer?.name.toLowerCase().includes(q) ?? false) ||
          (s.vehicle?.brand.toLowerCase().includes(q) ?? false) ||
          (s.vehicle?.model.toLowerCase().includes(q) ?? false) ||
          s.serviceType.toLowerCase().includes(q) ||
          s.technician.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') list = list.filter((s) => s.serviceType === typeFilter)
    if (vehicleFilter !== 'all') list = list.filter((s) => s.vehicleId === vehicleFilter)
    return list
  }, [services, vehicleById, search, typeFilter, vehicleFilter])

  const totals = useMemo(
    () => ({
      count: rows.length,
      revenue: rows.reduce((a, s) => a + s.cost, 0),
      avg: rows.length ? rows.reduce((a, s) => a + s.cost, 0) / rows.length : 0
    }),
    [rows]
  )

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(s: ServiceRecord) {
    setEditing(s)
    setForm({
      vehicleId: s.vehicleId,
      serviceDate: s.serviceDate,
      mileage: String(s.mileage),
      serviceType: s.serviceType,
      description: s.description,
      cost: String(s.cost),
      technician: s.technician
    })
    setErrors({})
    setModalOpen(true)
  }

  /** When a vehicle is picked, pre-fill mileage with its current odometer. */
  function onVehicleChange(vehicleId: string) {
    const v = vehicleById.get(vehicleId)
    setForm((f) => ({
      ...f,
      vehicleId,
      mileage: !editing && v ? String(v.currentMileage) : f.mileage
    }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.vehicleId) e.vehicleId = 'Select the vehicle that was serviced.'
    if (!form.serviceDate) e.serviceDate = 'Service date is required.'
    else if (!isValidDateString(form.serviceDate)) e.serviceDate = 'Enter a valid date.'
    else if (!isNotFuture(form.serviceDate)) e.serviceDate = 'Service date cannot be in the future.'
    e.mileage = nonNegativeNumber(form.mileage, 'Mileage', { max: 2_000_000 })
    e.serviceType = required(form.serviceType, 'Service type')
    e.cost = nonNegativeNumber(form.cost, 'Cost', { allowZero: false, max: 10_000_000 })
    e.technician = required(form.technician, 'Technician name')

    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as typeof e
    setErrors(clean)
    return Object.keys(clean).length === 0
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    const vehicle = vehicleById.get(form.vehicleId)
    if (!vehicle) {
      setErrors({ vehicleId: 'Selected vehicle no longer exists.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        vehicleId: form.vehicleId,
        customerId: vehicle.customerId,
        serviceDate: form.serviceDate,
        mileage: toNumber(form.mileage),
        serviceType: form.serviceType,
        description: form.description,
        cost: toNumber(form.cost),
        technician: form.technician
      }
      if (editing) {
        await updateServiceRecord(editing.id, payload, editing.vehicleId)
        toast.success('Service record updated. Vehicle prediction recalculated.')
      } else {
        await addServiceRecord(payload)
        toast.success('Service logged. Last service info and prediction updated.')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteServiceRecord(toDelete.id, toDelete.vehicleId)
      toast.success('Service record deleted. Prediction recalculated.')
      setToDelete(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setDeleting(false)
    }
  }

  const selectedVehicle = vehicleById.get(form.vehicleId) ?? null

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Service Records"
        subtitle="Every record updates the vehicle's last-service info and re-runs the prediction engine."
        actions={
          <button onClick={openAdd} className="btn-primary" disabled={vehiclesWithMeta.length === 0}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add service record
          </button>
        }
      />

      {vehiclesWithMeta.length === 0 && !loading && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-amber-900">
            Register a vehicle before logging service records.{' '}
            <Link to="/vehicles" className="font-semibold underline">
              Go to vehicles
            </Link>
            .
          </p>
        </div>
      )}

      {/* summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">Records shown</p>
          <p className="mt-1.5 text-2xl font-extrabold text-steel-900">{totals.count}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">Total revenue</p>
          <p className="mt-1.5 text-2xl font-extrabold text-emerald-600">{currency(totals.revenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">Average cost</p>
          <p className="mt-1.5 text-2xl font-extrabold text-steel-900">{currency(totals.avg)}</p>
        </div>
      </div>

      {/* toolbar */}
      <div className="card my-4 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search registration, customer, technician, service type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto"
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            aria-label="Filter by vehicle"
          >
            <option value="all">All vehicles</option>
            {vehiclesWithMeta.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by service type"
          >
            <option value="all">All service types</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={services.length === 0 ? 'No service records yet' : 'No matching records'}
            message={
              services.length === 0
                ? 'Log your first service to start building history — the prediction engine needs at least two records per vehicle to measure real intervals.'
                : 'Try a different search term or reset the filters.'
            }
            action={
              services.length === 0 ? (
                vehiclesWithMeta.length > 0 ? (
                  <button onClick={openAdd} className="btn-primary">
                    Log first service
                  </button>
                ) : (
                  <Link to="/vehicles" className="btn-primary">
                    Add a vehicle first
                  </Link>
                )
              ) : (
                <button
                  onClick={() => {
                    setSearch('')
                    setTypeFilter('all')
                    setVehicleFilter('all')
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
                  <th className="th">Date</th>
                  <th className="th">Vehicle</th>
                  <th className="th">Customer</th>
                  <th className="th">Service</th>
                  <th className="th">Mileage</th>
                  <th className="th">Technician</th>
                  <th className="th text-right">Cost</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {rows.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-steel-50">
                    <td className="td whitespace-nowrap font-medium">{formatDate(s.serviceDate)}</td>
                    <td className="td">
                      {s.vehicle ? (
                        <Link to={`/vehicles/${s.vehicle.id}`} className="font-semibold text-brand-600 hover:underline">
                          {s.vehicle.registrationNumber}
                        </Link>
                      ) : (
                        <span className="text-steel-400">Deleted</span>
                      )}
                      {s.vehicle && (
                        <p className="text-xs text-steel-500">
                          {s.vehicle.brand} {s.vehicle.model}
                        </p>
                      )}
                    </td>
                    <td className="td">
                      {s.vehicle?.customer ? (
                        <Link to={`/customers/${s.vehicle.customer.id}`} className="hover:underline">
                          {s.vehicle.customer.name}
                        </Link>
                      ) : (
                        <span className="text-steel-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      {s.serviceType}
                      {s.description && (
                        <p className="max-w-[220px] truncate text-xs text-steel-500">{s.description}</p>
                      )}
                    </td>
                    <td className="td whitespace-nowrap">{km(s.mileage)}</td>
                    <td className="td">{s.technician || '—'}</td>
                    <td className="td whitespace-nowrap text-right font-semibold">{currency(s.cost)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="btn-ghost p-2" title="Edit record">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setToDelete(s)}
                          className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                          title="Delete record"
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
              <tfoot className="border-t-2 border-steel-200 bg-steel-50">
                <tr>
                  <td className="td font-bold" colSpan={6}>
                    Total ({rows.length} record{rows.length === 1 ? '' : 's'})
                  </td>
                  <td className="td text-right text-base font-extrabold text-emerald-600">
                    {currency(totals.revenue)}
                  </td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* add / edit service */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit service record' : 'Add service record'}
        subtitle="Saving updates the vehicle's last service, next prediction and status."
        size="lg"
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Vehicle" error={errors.vehicleId} required>
            <select
              className={`input ${errors.vehicleId ? 'input-error' : ''}`}
              value={form.vehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
            >
              <option value="">Select a vehicle…</option>
              {vehiclesWithMeta.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} — {v.brand} {v.model}
                  {v.customer ? ` (${v.customer.name})` : ''}
                </option>
              ))}
            </select>
          </Field>

          {selectedVehicle && (
            <div className="flex flex-wrap gap-4 rounded-lg bg-steel-50 px-3.5 py-2.5 text-xs">
              <span>
                <span className="text-steel-500">Current mileage: </span>
                <strong>{km(selectedVehicle.currentMileage)}</strong>
              </span>
              <span>
                <span className="text-steel-500">Last service: </span>
                <strong>{formatDate(selectedVehicle.lastServiceDate)}</strong>
              </span>
              <span>
                <span className="text-steel-500">Records: </span>
                <strong>{selectedVehicle.services.length}</strong>
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service date" error={errors.serviceDate} required>
              <input
                type="date"
                className={`input ${errors.serviceDate ? 'input-error' : ''}`}
                max={toISODate(new Date())}
                value={form.serviceDate}
                onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
              />
            </Field>
            <Field
              label="Mileage at service (km)"
              error={errors.mileage}
              hint="Odometer reading on the service date."
              required
            >
              <input
                className={`input ${errors.mileage ? 'input-error' : ''}`}
                inputMode="numeric"
                placeholder="45000"
                value={form.mileage}
                onChange={(e) => setForm({ ...form, mileage: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service type" error={errors.serviceType} required>
              <select
                className={`input ${errors.serviceType ? 'input-error' : ''}`}
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cost (BDT)" error={errors.cost} required>
              <input
                className={`input ${errors.cost ? 'input-error' : ''}`}
                inputMode="numeric"
                placeholder="4500"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Technician" error={errors.technician} required>
            <input
              className={`input ${errors.technician ? 'input-error' : ''}`}
              placeholder="e.g. Rahim Mia"
              value={form.technician}
              onChange={(e) => setForm({ ...form, technician: e.target.value })}
            />
          </Field>

          <Field label="Description / work done" hint="Optional notes about the work performed.">
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Engine oil + filter replaced, brake pads inspected, AC gas topped up."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add service record'}
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
              <strong>{formatDate(toDelete?.serviceDate)}</strong> will be permanently deleted.
            </p>
            <p className="mt-2">The vehicle&apos;s prediction will be recalculated automatically.</p>
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
