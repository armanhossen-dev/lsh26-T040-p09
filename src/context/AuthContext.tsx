import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  type User
} from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, friendlyError, googleProvider } from '@/lib/firebase'
import { createUserProfile, getUserProfile, updateUserProfile } from '@/lib/db'
import type { AppUser } from '@/types'

interface AuthApi {
  user: User | null
  profile: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changeName: (name: string) => Promise<void>
  changePassword: (next: string) => Promise<void>
  reloadProfile: () => Promise<void>
  /** True when the account has an email/password credential (not Google-only). */
  hasPasswordCredential: boolean
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // If the browser blocked popups we fall back to a full-page redirect; this
  // picks the result back up when the user lands on the app again.
  useEffect(() => {
    getRedirectResult(auth).catch(() => {
      /* no pending redirect — normal on a cold load */
    })
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          let p = await getUserProfile(u.uid)
          if (!p) {
            // Self-heal: account exists in Auth but the profile doc is missing.
            await createUserProfile({
              uid: u.uid,
              name: u.displayName || u.email?.split('@')[0] || 'Staff',
              email: u.email ?? ''
            })
            p = await getUserProfile(u.uid)
          }
          setProfile(p)
        } catch {
          // Rules may block reads before sign-in completes; keep a usable fallback.
          setProfile({
            uid: u.uid,
            name: u.displayName || u.email?.split('@')[0] || 'Staff',
            email: u.email ?? '',
            role: 'staff'
          })
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const api = useMemo<AuthApi>(
    () => ({
      user,
      profile,
      loading,
      async login(email, password) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password)
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      async loginWithGoogle() {
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (e) {
          const code =
            typeof e === 'object' && e !== null && 'code' in e
              ? String((e as { code: unknown }).code)
              : ''
          // Popups are blocked in some embedded/mobile browsers — retry as a redirect.
          if (
            code === 'auth/popup-blocked' ||
            code === 'auth/operation-not-supported-in-this-environment'
          ) {
            await signInWithRedirect(auth, googleProvider)
            return
          }
          throw new Error(friendlyError(e))
        }
        // The users/{uid} profile document is created by the onAuthStateChanged
        // handler above if this is the account's first Google sign-in.
      },
      async register(name, email, password) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
          await updateProfile(cred.user, { displayName: name.trim() })
          await createUserProfile({
            uid: cred.user.uid,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: 'staff'
          })
          setProfile(await getUserProfile(cred.user.uid))
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      async logout() {
        try {
          await signOut(auth)
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      async changeName(name) {
        if (!auth.currentUser) throw new Error('You are not signed in.')
        try {
          await updateProfile(auth.currentUser, { displayName: name.trim() })
          await updateUserProfile(auth.currentUser.uid, { name: name.trim() })
          setProfile((p) => (p ? { ...p, name: name.trim() } : p))
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      async changePassword(next) {
        if (!auth.currentUser) throw new Error('You are not signed in.')
        try {
          await updatePassword(auth.currentUser, next)
        } catch (e) {
          throw new Error(friendlyError(e))
        }
      },
      async reloadProfile() {
        if (!auth.currentUser) return
        setProfile(await getUserProfile(auth.currentUser.uid))
      },
      hasPasswordCredential: (user?.providerData ?? []).some((p) => p.providerId === 'password')
    }),
    [user, profile, loading]
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
