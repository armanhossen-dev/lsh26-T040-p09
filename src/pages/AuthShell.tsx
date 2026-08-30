import type { ReactNode } from 'react'

/** Shared split-screen frame for the Login and Register pages. */
export default function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-steel-50">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-steel-950 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #3563f3 0, transparent 45%), radial-gradient(circle at 80% 70%, #1b2c72 0, transparent 50%)'
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white">AutoServe Dhaka</p>
            <p className="text-xs font-medium text-steel-400">Workshop Management System</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight text-white">
            Know which vehicle needs service — before the customer calls.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-steel-300">
            AutoServe analyses each vehicle&apos;s real service history to forecast the next service
            by both mileage and time, then flags anything overdue or due soon.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[
              { k: 'Mileage', v: 'km-based forecast' },
              { k: 'Time', v: 'date-based forecast' },
              { k: 'Explained', v: 'no black boxes' }
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-steel-800 bg-steel-900/60 p-3">
                <dt className="text-sm font-bold text-white">{s.k}</dt>
                <dd className="mt-0.5 text-[11px] text-steel-400">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-steel-500">
          Prediction engine uses transparent statistics from your own records — not a black-box model.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <div>
              <p className="text-base font-extrabold text-steel-900">AutoServe Dhaka</p>
              <p className="text-[11px] font-medium text-steel-500">Workshop Management System</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h1 className="text-xl font-extrabold text-steel-900">{title}</h1>
            <p className="mt-1 mb-6 text-sm text-steel-500">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
