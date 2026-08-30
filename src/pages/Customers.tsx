import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  formatDate
} from '@/components/ui'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { addCustomer, deleteCustomerCascade, updateCustomer } from '@/lib/db'
import { friendlyError } from '@/lib/firebase'
import { isEmail, isPhone, required } from '@/lib/validation'
import type { Customer } from '@/types'

interface Form {
  name: string
  phone: string
  email: string
  address: string
}
const EMPTY: Form = { name: '', phone: '', email: '', address: '' }

type SortKey = 'name' | 'vehicles' | 'spend' | 'created'

export default function Customers() {
  const { customers, vehiclesWithMeta, services, loading, error } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [filterHasVehicle, setFilterHasVehicle] = useState<'all' | 'with' | 'without'>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)

  const [toDelete, setToDelete] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Per-customer aggregates from live Firestore data. */
  const rows = useMemo(() => {
    const vehiclesByCustomer = new Map<string, number>()
    const attentionByCustomer = new Map<string, number>()
    for (const v of vehiclesWithMeta) {
      vehiclesByCustomer.set(v.customerId, (vehiclesByCustomer.get(v.customerId) ?? 0) + 1)
      if (v.prediction.status === 'OVERDUE' || v.prediction.status === 'DUE_SOON') {
        attentionByCustomer.set(v.customerId, (attentionByCustomer.get(v.customerId) ?? 0) + 1)
      }
    }
    const spendByCustomer = new Map<string, number>()
    for (const s of services) {
      spendByCustomer.set(s.customerId, (spendByCustomer.get(s.customerId) ?? 0) + s.cost)
    }

    let list = customers.map((c) => ({
      ...c,
      vehicleCount: vehiclesByCustomer.get(c.id) ?? 0,
      attentionCount: attentionByCustomer.get(c.id) ?? 0,
      totalSpend: spendByCustomer.get(c.id) ?? 0
    }))

    const q = search.trim().toLowerCase()
    if (q) {
      const digits = q.replace(/\D/g, '')
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
      )
    }

    if (filterHasVehicle === 'with') list = list.filter((c) => c.vehicleCount > 0)
    if (filterHasVehicle === 'without') list = list.filter((c) => c.vehicleCount === 0)

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'vehicles') return b.vehicleCount - a.vehicleCount
      if (sort === 'spend') return b.totalSpend - a.totalSpend
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })
    return list
  }, [customers, vehiclesWithMeta, services, search, sort, filterHasVehicle])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address })
    setErrors({})
    setModalOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {}
    e.name = required(form.name, 'Customer name')
    if (!form.phone.trim()) e.phone = 'Phone number is required.'
    else if (!isPhone(form.phone))
      e.phone = 'Enter a valid Bangladeshi number, e.g. 01712345678.'
    if (form.email.trim() && !isEmail(form.email)) e.email = 'Enter a valid email address.'
    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as typeof e
    setErrors(clean)
    return Object.keys(clean).length === 0
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (editing) {
        await updateCustomer(editing.id, form)
        toast.success(`${form.name.trim()} updated successfully.`)
      } else {
        await addCustomer(form)
        toast.success(`${form.name.trim()} added to customers.`)
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
      const res = await deleteCustomerCascade(toDelete.id)
      toast.success(
        `${toDelete.name} deleted` +
          (res.vehicles || res.services
            ? ` along with ${res.vehicles} vehicle(s) and ${res.services} service record(s).`
            : '.')
      )
      setToDelete(null)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setDeleting(false)
    }
  }

  const deleteInfo = useMemo(() => {
    if (!toDelete) return { vehicles: 0, services: 0 }
    return {
      vehicles: vehiclesWithMeta.filter((v) => v.customerId === toDelete.id).length,
      services: services.filter((s) => s.customerId === toDelete.id).length
    }
  }, [toDelete, vehiclesWithMeta, services])

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} registered customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <button onClick={openAdd} className="btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add customer
          </button>
        }
      />

      {/* toolbar */}
      <div className="card mb-4 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search by name, phone, email or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-steel-400 hover:bg-steel-100"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={filterHasVehicle}
            onChange={(e) => setFilterHasVehicle(e.target.value as typeof filterHasVehicle)}
            aria-label="Filter by vehicles"
          >
            <option value="all">All customers</option>
            <option value="with">With vehicles</option>
            <option value="without">Without vehicles</option>
          </select>
          <select
            className="input w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort customers"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="vehicles">Sort: Most vehicles</option>
            <option value="spend">Sort: Highest spend</option>
            <option value="created">Sort: Newest first</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={customers.length === 0 ? 'No customers yet' : 'No matching customers'}
            message={
              customers.length === 0
                ? 'Register your first customer to start tracking their vehicles and service history.'
                : 'Try a different search term or clear the filters.'
            }
            action={
              customers.length === 0 ? (
                <button onClick={openAdd} className="btn-primary">
                  Add your first customer
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearch('')
                    setFilterHasVehicle('all')
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
                  <th className="th">Customer</th>
                  <th className="th">Contact</th>
                  <th className="th">Vehicles</th>
                  <th className="th">Total spend</th>
                  <th className="th">Added</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-steel-50">
                    <td className="td">
                      <Link to={`/customers/${c.id}`} className="font-semibold text-brand-600 hover:underline">
                        {c.name}
                      </Link>
                      {c.address && (
                        <p className="max-w-[220px] truncate text-xs text-steel-500">{c.address}</p>
                      )}
                    </td>
                    <td className="td">
                      <a href={`tel:${c.phone}`} className="hover:underline">
                        {c.phone}
                      </a>
                      {c.email && <p className="truncate text-xs text-steel-500">{c.email}</p>}
                    </td>
                    <td className="td">
                      <span className="font-semibold">{c.vehicleCount}</span>
                      {c.attentionCount > 0 && (
                        <span className="ml-2 badge bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                          {c.attentionCount} due
                        </span>
                      )}
                    </td>
                    <td className="td font-semibold">{currency(c.totalSpend)}</td>
                    <td className="td whitespace-nowrap text-steel-500">{formatDate(c.createdAt)}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/customers/${c.id}`} className="btn-ghost p-2" title="View details">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </Link>
                        <button onClick={() => openEdit(c)} className="btn-ghost p-2" title="Edit customer">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
                          className="btn-ghost p-2 text-red-600 hover:bg-red-50"
                          title="Delete customer"
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

      {/* add / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit customer' : 'Add new customer'}
        subtitle={editing ? `Updating ${editing.name}` : 'Customer details are saved to Firestore.'}
      >
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Full name" error={errors.name} required>
            <input
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Md. Karim Hossain"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number" error={errors.phone} hint="e.g. 01712345678" required>
              <input
                className={`input ${errors.phone ? 'input-error' : ''}`}
                placeholder="01712345678"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email address" error={errors.email} hint="Optional">
              <input
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="customer@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Address" hint="Optional — area, road, city">
            <textarea
              className="input min-h-[76px] resize-y"
              placeholder="House 12, Road 5, Dhanmondi, Dhaka"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete customer?"
        busy={deleting}
        message={
          <>
            <p>
              <strong>{toDelete?.name}</strong> will be permanently deleted from Firestore.
            </p>
            {(deleteInfo.vehicles > 0 || deleteInfo.services > 0) && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                This also deletes <strong>{deleteInfo.vehicles} vehicle(s)</strong> and{' '}
                <strong>{deleteInfo.services} service record(s)</strong> belonging to this customer.
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
