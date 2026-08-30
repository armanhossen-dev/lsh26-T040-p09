import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Config is read from Vite env vars (set in .env / Cloudflare Pages build vars).
 * The fallbacks keep the provided dev project working out of the box; production
 * builds should always supply VITE_FIREBASE_* variables.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB2EMLhCcS77caRx8ZxYrSaXyxB2MANIzE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'project-9-a6037.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'project-9-a6037',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'project-9-a6037.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '479696854558',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:479696854558:web:3cd2a7f0097b4c1b67180f'
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const projectId = firebaseConfig.projectId as string

/**
 * Google OAuth provider for signInWithPopup / signInWithRedirect.
 * `prompt: 'select_account'` forces the account chooser so staff sharing a
 * workstation are never silently signed in as the previous user.
 */
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
googleProvider.addScope('profile')
googleProvider.addScope('email')

// Keep the session across refreshes (required by the persistence test cases).
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* non-fatal: falls back to in-memory persistence */
})

/** Map raw Firebase error codes to messages a workshop staffer can act on. */
export function friendlyError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address is not valid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/operation-not-allowed':
      'Email/Password sign-in is not enabled on this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/requires-recent-login': 'Please log out and log in again before changing your password.',
    // --- Google / popup sign-in ---
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing. Please try again.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open. Close it and try again.',
    'auth/popup-blocked':
      'Your browser blocked the Google sign-in popup. Allow popups for this site, then try again.',
    'auth/unauthorized-domain': `This site's domain (${
      typeof window !== 'undefined' ? window.location.hostname : 'unknown'
    }) is not in the Firebase authorised domains list. Add it in Firebase Console → Authentication → Settings → Authorised domains.`,
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method. Sign in with your password instead.',
    'auth/internal-error-encountered': 'Google sign-in failed unexpectedly. Please try again.',
    'permission-denied':
      'Permission denied by Firestore security rules. Make sure you are signed in and the rules are deployed.',
    unavailable: 'Cannot reach Firestore right now. Check your connection and retry.',
    'failed-precondition':
      'Firestore needs an index for this query. Open the browser console and follow the index creation link.',
    unauthenticated: 'Your session expired. Please sign in again.'
  }
  if (map[code]) return map[code]
  const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error')
  return msg.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[^)]+\)\.?$/, '')
}
