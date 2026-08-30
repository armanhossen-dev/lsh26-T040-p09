import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'

/**
 * Firebase only permits OAuth popups from hostnames on its authorised-domains
 * list. Rather than let the user click and hit `auth/unauthorized-domain`, we
 * check the list up front and show them exactly what to add.
 * Returns `null` while unknown so nothing flashes on screen.
 */
export function useDomainAuthorised(): boolean | null {
  const [okDomain, setOkDomain] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    const host = window.location.hostname
    const key = import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB2EMLhCcS77caRx8ZxYrSaXyxB2MANIzE'

    fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config unavailable'))))
      .then((cfg: { authorizedDomains?: string[] }) => {
        if (!alive) return
        const list = cfg.authorizedDomains ?? []
        // Firebase treats a listed domain as covering its subdomains.
        setOkDomain(list.some((d) => host === d || host.endsWith(`.${d}`)))
      })
      .catch(() => {
        // Can't tell — assume fine so we never block a working setup.
        if (alive) setOkDomain(true)
      })

    return () => {
      alive = false
    }
  }, [])

  return okDomain
}

/** Actionable banner shown when the current hostname isn't authorised. */
export function DomainWarning() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  return (
    <div
      data-testid="domain-warning"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
    >
      <p className="font-bold">Google sign-in needs this domain authorised</p>
      <p className="mt-1">
        Add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono font-semibold">{host}</code>{' '}
        under{' '}
        <a
          className="font-semibold underline"
          href="https://console.firebase.google.com/project/project-9-a6037/authentication/settings"
          target="_blank"
          rel="noreferrer"
        >
          Firebase → Authentication → Settings → Authorised domains
        </a>
        , then reload. Email sign-in below works either way.
      </p>
    </div>
  )
}

/** Official Google "G" mark, drawn inline so it works offline / with no CDN. */
function GoogleLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

interface Props {
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  label?: string
}

export default function GoogleButton({
  onClick,
  busy = false,
  disabled = false,
  label = 'Continue with Google'
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      data-testid="google-signin"
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-steel-300 bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 shadow-sm transition hover:bg-steel-50 hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Spinner className="h-5 w-5" /> : <GoogleLogo />}
      <span>{busy ? 'Opening Google…' : label}</span>
    </button>
  )
}

/** "or" separator used between the Google button and the email form. */
export function OrDivider({ text = 'or' }: { text?: string }) {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-steel-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs font-medium uppercase tracking-wider text-steel-400">
          {text}
        </span>
      </div>
    </div>
  )
}
