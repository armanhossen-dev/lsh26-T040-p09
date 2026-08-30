import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
  currency,
  formatDate,
  km
} from '@/components/ui'
import { FullPageLoader } from '@/components/ui'
import { useData } from '@/context/DataContext'

export default function CustomerDetails() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { customerById, vehiclesWithMeta, services, loading, error } = useData()

  const customer = customerById.get(id) ?? null
  const vehicles = useMemo(
    () => vehiclesWithMeta.filter((v) => v.customerId === id),
    [vehiclesWithMeta, id]
  )
  const history = useMemo(
    () => services.filter((s) => s.customerId === id).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)),
    [services, id]
  )
  const totalSpend = history.reduce((a, s) => a + s.cost, 0)
  const attention = vehicles.filter(
    (v) => v.prediction.status === 'OVERDUE' || v.prediction.status === 'DUE_SOON'
  ).length

  if (error) return <ErrorState message={error} />
  if (loading) return <FullPageLoader label="Loading customer…" />

  if (!customer) {
    return (
      <div className="card">
        <EmptyState
          title="Customer not found"
          message="This customer may have been deleted, or the link is incorrect."
          action={
            <Link to="/customers" className="btn-primary">
              Back to customers
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => nav('/customers')} className="btn-ghost mb-3 -ml-2 text-sm">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to customers
      </button>

      <PageHeader
        title={customer.name}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
        actions={
          <>
            <a href={`tel:${customer.phone}`} className="btn-secondary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              Call customer
            </a>
            <Link to="/vehicles" className="btn-primary">
              Add vehicle
            </Link>
          </>
        }
      />

      {/* summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Vehicles" value={String(vehicles.length)} />
        <Tile label="Total services" value={String(history.length)} />
        <Tile label="Total spending" value={currency(totalSpend)} accent="text-emerald-600" />
        <Tile
          label="Need attention"
          value={String(attention)}
          accent={attention > 0 ? 'text-amber-600' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* contact info */}
        <div className="card p-5 lg:col-span-1">
          <h3 className="mb-4 font-bold text-steel-900">Customer information</h3>
          <dl className="space-y-3.5 text-sm">
            <Row label="Full name" value={customer.name} />
            <Row
              label="Phone"
              value={
                <a href={`tel:${customer.phone}`} className="link">
                  {customer.phone}
                </a>
              }
            />
            <Row
              label="Email"
              value={
                customer.email ? (
                  <a href={`mailto:${customer.email}`} className="link break-all">
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-steel-400">Not provided</span>
                )
              }
            />
            <Row
              label="Address"
              value={customer.address || <span className="text-steel-400">Not provided</span>}
            />
            <Row label="Registered" value={formatDate(customer.createdAt)} />
          </dl>
        </div>

        {/* vehicles */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-steel-200 px-5 py-4">
            <h3 className="font-bold text-steel-900">Vehicles ({vehicles.length})</h3>
            <p className="text-xs text-steel-500">Prediction status is computed live from service history</p>
          </div>
          {vehicles.length === 0 ? (
            <EmptyState
              title="No vehicles registered"
              message="Add a vehicle for this customer to begin tracking mileage and service predictions."
              action={
                <Link to="/vehicles" className="btn-primary">
                  Add vehicle
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-steel-100">
              {vehicles.map((v) => (
                <Link
                  key={v.id}
                  to={`/vehicles/${v.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-steel-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-steel-900">{v.registrationNumber}</p>
                      <StatusBadge status={v.prediction.status} size="sm" />
                    </div>
                    <p className="mt-0.5 text-sm text-steel-500">
                      {v.brand} {v.model} · {v.year} · {v.vehicleType}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold text-steel-800">{km(v.currentMileage)}</p>
                    <p className="text-xs text-steel-500">
                      Next: {formatDate(v.prediction.predictedDate)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* service history */}
      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-steel-200 px-5 py-4">
          <h3 className="font-bold text-steel-900">Service history ({history.length})</h3>
          <p className="text-xs text-steel-500">
            All services across this customer&apos;s vehicles · total {currency(totalSpend)}
          </p>
        </div>
        {history.length === 0 ? (
          <EmptyState
            title="No service records"
            message="Service records logged for this customer's vehicles will appear here."
            action={
              <Link to="/services" className="btn-primary">
                Log a service
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Vehicle</th>
                  <th className="th">Service type</th>
                  <th className="th">Mileage</th>
                  <th className="th">Technician</th>
                  <th className="th text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {history.map((s) => {
                  const veh = vehiclesWithMeta.find((v) => v.id === s.vehicleId)
                  return (
                    <tr key={s.id} className="hover:bg-steel-50">
                      <td className="td whitespace-nowrap">{formatDate(s.serviceDate)}</td>
                      <td className="td">
                        {veh ? (
                          <Link to={`/vehicles/${veh.id}`} className="font-medium text-brand-600 hover:underline">
                            {veh.registrationNumber}
                          </Link>
                        ) : (
                          <span className="text-steel-400">Deleted vehicle</span>
                        )}
                      </td>
                      <td className="td">
                        {s.serviceType}
                        {s.description && (
                          <p className="max-w-[260px] truncate text-xs text-steel-500">{s.description}</p>
                        )}
                      </td>
                      <td className="td whitespace-nowrap">{km(s.mileage)}</td>
                      <td className="td">{s.technician || '—'}</td>
                      <td className="td text-right font-semibold">{currency(s.cost)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-steel-200 bg-steel-50">
                <tr>
                  <td className="td font-bold" colSpan={5}>
                    Total spending
                  </td>
                  <td className="td text-right text-base font-extrabold text-emerald-600">
                    {currency(totalSpend)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold ${accent ?? 'text-steel-900'}`}>{value}</p>
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
