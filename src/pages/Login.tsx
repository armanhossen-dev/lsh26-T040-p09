import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '@/components/ui'
import GoogleButton, {
  DomainWarning,
  OrDivider,
  useDomainAuthorised
} from '@/components/GoogleButton'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { isEmail } from '@/lib/validation'
import AuthShell from './AuthShell'

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const domainOk = useDomainAuthorised()

  function validate() {
    const e: typeof errors = {}
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!isEmail(form.email)) e.email = 'Enter a valid email address.'
    if (!form.password) e.password = 'Password is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onGoogle() {
    setFormError(null)
    setErrors({})
    setGoogleBusy(true)
    try {
      await loginWithGoogle()
      toast.success('Signed in with Google')
      nav('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed.')
    } finally {
      setGoogleBusy(false)
    }
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setFormError(null)
    if (!validate()) return
    setBusy(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      nav('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to your workshop"
      subtitle="Access customer records, vehicles and service predictions."
    >
      <div className="space-y-4">
        {formError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
            role="alert"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.4}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm font-medium text-red-800">{formError}</p>
          </div>
        )}

        {domainOk === false && <DomainWarning />}
        <GoogleButton onClick={onGoogle} busy={googleBusy} disabled={busy} />
        <OrDivider text="or sign in with email" />
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <Field label="Email address" error={errors.email} required>
          <input
            type="email"
            autoComplete="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="staff@workshop.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>

        <Field label="Password" error={errors.password} required>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-steel-400 hover:text-steel-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {showPw ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </Field>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || googleBusy}>
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-steel-500">
          Don&apos;t have a staff account?{' '}
          <Link to="/register" className="link">
            Register here
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
