import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  currency,
  formatDate,
  km,
  chartNum
} from '@/components/ui'
import { useData } from '@/context/DataContext'
import { STATUS_META, parseDate } from '@/lib/prediction'
import type { PredictionStatus } from '@/types'

export default function Dashboard() {
  const { customers, vehiclesWithMeta, services, loading, error } = useData()

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const servicesThisMonth = services.filter((s) => {
      const d = parseDate(s.serviceDate)
      return d !== null && d >= monthStart && d <= now
    })

    const byStatus = (st: PredictionStatus) =>
      vehiclesWithMeta.filter((v) => v.prediction.status === st)

    const revenueThisMonth = servicesThisMonth.reduce((a, s) => a + s.cost, 0)

    return {
      customers: customers.length,
      vehicles: vehiclesWithMeta.length,
      servicesThisMonth: servicesThisMonth.length,
      revenueThisMonth,
      dueSoon: byStatus('DUE_SOON').length,
      overdue: byStatus('OVERDUE').length,
      safe: byStatus('SAFE').length,
      noData: byStatus('NO_DATA').length,
      totalRevenue: services.reduce((a, s) => a + s.cost, 0)
    }
  }, [customers, vehiclesWithMeta, services])

  /** Services + revenue for the trailing 6 months, derived from real records. */
  const monthly = useMemo(() => {
    const buckets: { key: string; label: string; services: number; revenue: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        services: 0,
        revenue: 0
      })
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const s of services) {
      const key = s.serviceDate.slice(0, 7)
      const i = index.get(key)
      if (i !== undefined) {
        buckets[i].services += 1
        buckets[i].revenue += s.cost
      }
    }
    return buckets
  }, [services])

  const statusPie = useMemo(
    () =>
      (['SAFE', 'DUE_SOON', 'OVERDUE', 'NO_DATA'] as PredictionStatus[])
        .map((st) => ({
          name: STATUS_META[st].label,
          value: vehiclesWithMeta.filter((v) => v.prediction.status === st).length,
          color: STATUS_META[st].chart
        }))
        .filter((d) => d.value > 0),
    [vehiclesWithMeta]
  )

  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of vehiclesWithMeta) m.set(v.vehicleType, (m.get(v.vehicleType) ?? 0) + 1)
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [vehiclesWithMeta])

  const attention = useMemo(
    () =>
      vehiclesWithMeta.filter(
        (v) => v.prediction.status === 'OVERDUE' || v.prediction.status === 'DUE_SOON'
      ),
    [vehiclesWithMeta]
  )

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <PageHeader
        title="Workshop Dashboard"
        subtitle="Live figures from your Firestore records — no sample data."
        actions={
          <>
            <Link to="/services" className="btn-secondary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Log service
            </Link>
            <Link to="/vehicles" className="btn-primary">
              View vehicles
            </Link>
          </>
        }
      />

      {/* ---------------------------- stat cards ---------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Customers"
          value={stats.customers}
          loading={loading}
          tone="brand"
          to="/customers"
          icon="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
        <StatCard
          label="Total Vehicles"
          value={stats.vehicles}
          loading={loading}
          tone="steel"
          to="/vehicles"
          icon="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
        />
        <StatCard
          label="Services This Month"
          value={stats.servicesThisMonth}
          sub={currency(stats.revenueThisMonth)}
          loading={loading}
          tone="indigo"
          to="/services"
          icon="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877m0 0a3.75 3.75 0 0 0-5.304-5.303 3.75 3.75 0 0 0-1.06 3.18l-3.94 3.94a3.75 3.75 0 0 0 5.303 5.303l3.94-3.94Z"
        />
        <StatCard
          label="Due Soon"
          value={stats.dueSoon}
          loading={loading}
          tone="amber"
          to="/vehicles?filter=DUE_SOON"
          icon="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
        <StatCard
          label="Overdue Vehicles"
          value={stats.overdue}
          loading={loading}
          tone="red"
          to="/vehicles?filter=OVERDUE"
          icon="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
        />
      </div>

      {/* ------------------------------ charts ------------------------------ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Services per month"
          subtitle="Number of service records in the last 6 months"
          empty={services.length === 0}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#66768d' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#66768d' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => {
                  const n = chartNum(v)
                  return [`${n} service${n === 1 ? '' : 's'}`, 'Services']
                }}
              />
              <Bar dataKey="services" fill="#1f43e0" radius={[6, 6, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Service cost trends"
          subtitle="Total revenue collected per month (BDT)"
          empty={services.length === 0}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#66768d' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#66768d' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [currency(chartNum(v)), 'Revenue']} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Vehicle service status"
          subtitle="Distribution of prediction statuses across the fleet"
          empty={vehiclesWithMeta.length === 0}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusPie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={3}
                label={(e: { name?: string; value?: number }) => `${e.name}: ${e.value}`}
                labelLine={false}
              >
                {statusPie.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${chartNum(v)} vehicle(s)`, 'Count']} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Service distribution by vehicle type"
          subtitle="Registered vehicles grouped by type"
          empty={vehiclesWithMeta.length === 0}
          loading={loading}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 20, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#66768d' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                tick={{ fontSize: 11, fill: '#66768d' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${chartNum(v)} vehicle(s)`, 'Count']} />
              <Bar dataKey="count" fill="#5b89fc" radius={[0, 6, 6, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ------------------- vehicles requiring attention ------------------- */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-steel-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-steel-900">Vehicles Requiring Attention</h3>
            <p className="text-xs text-steel-500">
              Overdue and due-soon vehicles, most urgent first
            </p>
          </div>
          {attention.length > 0 && (
            <Link to="/vehicles?filter=attention" className="btn-secondary text-xs">
              View all {attention.length}
            </Link>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : attention.length === 0 ? (
          <EmptyState
            title={vehiclesWithMeta.length === 0 ? 'No vehicles registered yet' : 'All clear!'}
            message={
              vehiclesWithMeta.length === 0
                ? 'Add customers and vehicles, then log service records to activate the prediction engine.'
                : 'No vehicle is overdue or due for service soon. The prediction engine will flag them here automatically.'
            }
            action={
              vehiclesWithMeta.length === 0 ? (
                <Link to="/vehicles" className="btn-primary">
                  Add a vehicle
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="th">Vehicle</th>
                  <th className="th">Customer</th>
                  <th className="th">Last service</th>
                  <th className="th">Predicted next</th>
                  <th className="th">Remaining</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {attention.slice(0, 8).map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-steel-50">
                    <td className="td">
                      <Link to={`/vehicles/${v.id}`} className="font-semibold text-brand-600 hover:underline">
                        {v.registrationNumber}
                      </Link>
                      <p className="text-xs text-steel-500">
                        {v.brand} {v.model} · {v.vehicleType}
                      </p>
                    </td>
                    <td className="td">
                      {v.customer ? (
                        <Link to={`/customers/${v.customer.id}`} className="hover:underline">
                          {v.customer.name}
                        </Link>
                      ) : (
                        <span className="text-steel-400">—</span>
                      )}
                      <p className="text-xs text-steel-500">{v.customer?.phone}</p>
                    </td>
                    <td className="td whitespace-nowrap">
                      {formatDate(v.lastServiceDate)}
                      <p className="text-xs text-steel-500">{km(v.lastServiceMileage)}</p>
                    </td>
                    <td className="td whitespace-nowrap">
                      {formatDate(v.prediction.predictedDate)}
                      <p className="text-xs text-steel-500">{km(v.prediction.predictedMileage)}</p>
                    </td>
                    <td className="td whitespace-nowrap">
                      <span
                        className={
                          (v.prediction.daysRemaining ?? 0) < 0 ? 'font-semibold text-red-600' : ''
                        }
                      >
                        {v.prediction.daysRemaining === null
                          ? '—'
                          : v.prediction.daysRemaining < 0
                            ? `${Math.abs(v.prediction.daysRemaining)} days late`
                            : `${v.prediction.daysRemaining} days`}
                      </span>
                      <p
                        className={`text-xs ${
                          (v.prediction.kmRemaining ?? 0) < 0 ? 'font-semibold text-red-600' : 'text-steel-500'
                        }`}
                      >
                        {v.prediction.kmRemaining === null
                          ? '—'
                          : v.prediction.kmRemaining < 0
                            ? `${Math.abs(v.prediction.kmRemaining).toLocaleString()} km over`
                            : `${v.prediction.kmRemaining.toLocaleString()} km`}
                      </p>
                    </td>
                    <td className="td">
                      <StatusBadge status={v.prediction.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------- engine disclosure ------------------------ */}
      <div className="card mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <div className="text-sm">
          <p className="font-bold text-steel-900">How the prediction engine works</p>
          <p className="mt-1 leading-relaxed text-steel-600">
            This is a <strong>transparent statistical engine</strong>, not a machine-learning model
            and nothing is randomised. For each vehicle it measures the average km and the average
            number of days between consecutive service records, projects both forward from the last
            service, and uses whichever threshold arrives first. With fewer than two records it falls
            back to a documented interval for the vehicle type and reports lower confidence. Every
            vehicle page shows the exact numbers behind its forecast.
          </p>
        </div>
      </div>
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #d5dae2',
  fontSize: 12,
  boxShadow: '0 6px 20px rgba(34,39,46,.10)'
} as const

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  steel: 'bg-steel-100 text-steel-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600'
} as const

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
  loading,
  to
}: {
  label: string
  value: number
  sub?: string
  icon: string
  tone: keyof typeof TONES
  loading: boolean
  to: string
}) {
  return (
    <Link to={to} className="card p-4 transition hover:border-brand-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-14" />
      ) : (
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-steel-900">{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 text-xs font-medium text-steel-500">{sub}</p>}
    </Link>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  empty,
  loading
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  empty: boolean
  loading: boolean
}) {
  return (
    <div className="card p-5">
      <h3 className="font-bold text-steel-900">{title}</h3>
      <p className="mb-3 text-xs text-steel-500">{subtitle}</p>
      {loading ? (
        <div className="skeleton h-[260px] w-full" />
      ) : empty ? (
        <div className="flex h-[260px] flex-col items-center justify-center text-center">
          <svg className="mb-2 h-9 w-9 text-steel-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <p className="text-sm font-semibold text-steel-600">No data to chart yet</p>
          <p className="mt-0.5 max-w-xs text-xs text-steel-400">
            Charts populate automatically once records exist in Firestore.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
