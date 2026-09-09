import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

/**
 * App configuration, stored in Firestore at `config/app`.
 *
 * Service types, class years and the activity rule are fellowship data, not
 * code: they change when the fellowship changes, and editing them should not
 * require a redeploy. They previously lived as literals in four different
 * components, which had already drifted — NewService.jsx and NewServiceModal.jsx
 * each carried their own copy of the service-type list.
 *
 * DEFAULTS exist only so a missing or partial config document can never break
 * the public check-in page. They are a fallback, not the source of truth.
 */

const CONFIG_DOC = ['config', 'app']

export const DEFAULTS = {
  serviceTypes: [
    { name: 'Thursday Service', icon: '⛪' },
    { name: 'Special Service',  icon: '✨' },
    { name: 'Prayer Service',   icon: '🙏' },
    { name: 'Bible Study',      icon: '📚' },
  ],
  /** Extra options offered alongside the class years already present in members. */
  classOptions: ['Staff', 'Alumni', 'Visitor'],
  /** How many recent services a member can miss before they count as inactive. */
  inactiveAfterMissedServices: 3,
}

let cache = null

/** Reads `config/app`, falling back per-field so a partial document is safe. */
export async function getAppConfig({ force = false } = {}) {
  if (cache && !force) return cache
  let stored = {}
  try {
    const snap = await getDoc(doc(db, ...CONFIG_DOC))
    if (snap.exists()) stored = snap.data()
  } catch (err) {
    // A config read must never take down check-in.
    console.error('Could not read app config; using defaults.', err)
  }

  const types = Array.isArray(stored.serviceTypes) && stored.serviceTypes.length
    ? stored.serviceTypes.filter(t => t && t.name)
    : DEFAULTS.serviceTypes

  cache = {
    serviceTypes: types,
    classOptions: Array.isArray(stored.classOptions) ? stored.classOptions : DEFAULTS.classOptions,
    inactiveAfterMissedServices:
      Number.isFinite(stored.inactiveAfterMissedServices) && stored.inactiveAfterMissedServices > 0
        ? stored.inactiveAfterMissedServices
        : DEFAULTS.inactiveAfterMissedServices,
  }
  return cache
}

/** Admin-only. Writes the whole config document and refreshes the cache. */
export async function saveAppConfig(patch) {
  await setDoc(doc(db, ...CONFIG_DOC), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  cache = null
  return getAppConfig({ force: true })
}

/** Icon for a service type, resolved against config rather than a literal map. */
export function serviceTypeIcon(config, typeName) {
  return config?.serviceTypes?.find(t => t.name === typeName)?.icon || '•'
}

export function serviceTypeNames(config) {
  return (config?.serviceTypes || DEFAULTS.serviceTypes).map(t => t.name)
}
