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

interface Form {
  name: string
  email: string
  password: string
  confirm: string
}

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState<Form>({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const domainOk = useDomainAuthorised()

  const strength = (() => {
    const p = form.password
    let s = 0
    if (p.length >= 6) s++
    if (p.length >= 10) s++
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
    if (/\d/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return Math.min(s, 4)
  })()

  function validate() {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.name.trim()) e.name = 'Full name is required.'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!isEmail(form.email)) e.email = 'Enter a valid email address.'
    if (!form.password) e.password = 'Password is required.'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters.'
    if (!form.confirm) e.confirm = 'Please confirm your password.'
    else if (form.confirm !== form.password) e.confirm = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onGoogle() {
    setFormError(null)
    setGoogleBusy(true)
    try {
      await loginWithGoogle()
      toast.success('Account created with Google')
      nav('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-up failed.')
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
      await register(form.name, form.email, form.password)
      toast.success('Account created. Welcome to AutoServe!')
      nav('/dashboard', { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  const bars = ['bg-red-500', 'bg-amber-500', 'bg-amber-400', 'bg-emerald-500']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <AuthShell
      title="Create a staff account"
      subtitle="Register to manage customers, vehicles and service predictions."
    >
      <div className="space-y-4">
        {domainOk === false && <DomainWarning />}
        <GoogleButton onClick={onGoogle} busy={googleBusy} disabled={busy} label="Sign up with Google" />
        <OrDivider text="or use your email" />
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5" role="alert">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm font-medium text-red-800">{formError}</p>
          </div>
        )}

        <Field label="Full name" error={errors.name} required>
          <input
            className={`input ${errors.name ? 'input-error' : ''}`}
            placeholder="Karim Ahmed"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Email address" error={errors.email} required>
          <input
            type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="staff@workshop.com"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint={!form.password ? 'At least 6 characters.' : undefined}
          required
        >
          <input
            type="password"
            className={`input ${errors.password ? 'input-error' : ''}`}
            placeholder="••••••••"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {form.password && !errors.password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < strength ? bars[strength - 1] : 'bg-steel-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-semibold text-steel-500">
                {labels[Math.max(0, strength - 1)]}
              </span>
            </div>
          )}
        </Field>

        <Field label="Confirm password" error={errors.confirm} required>
          <input
            type="password"
            className={`input ${errors.confirm ? 'input-error' : ''}`}
            placeholder="••••••••"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>

        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || googleBusy}>
          {busy && <Spinner className="h-4 w-4" />}
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-steel-500">
          Already registered?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
