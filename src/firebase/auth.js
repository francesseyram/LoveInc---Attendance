import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './config'

/**
 * Sign in with email + password.
 * Only pre-created admin accounts can log in.
 */
export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await firebaseSignOut(auth)
}

/**
 * Subscribe to auth state changes.
 * Returns the unsubscribe function.
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback)
}

/**
 * Get the currently signed-in user (synchronous snapshot).
 */
export function getCurrentUser() {
  return auth.currentUser
}
