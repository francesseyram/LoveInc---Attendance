import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

/**
 * Service fliers.
 *
 * Fliers live in their own collection keyed by service id, NOT on the service
 * document: `getAllServices()` runs on every admin page load, and inlining a
 * few hundred KB of image data per service would make that read enormous.
 * The check-in page fetches exactly one flier, for the service it is showing.
 *
 * Images are stored as data URLs. That avoids standing up Firebase Storage and
 * a second set of security rules for what is one small image per service, but
 * it means a flier must stay under Firestore's 1 MB document ceiling — hence
 * the downscaling in prepareFlierImage().
 */

const FLIERS = 'serviceFliers'

/** Firestore caps a document at 1 MiB; leave room for the other fields. */
const MAX_DATA_URL_BYTES = 720 * 1024
const MAX_EDGE = 1400

/**
 * Downscale and re-encode a user-picked image until it fits.
 * Returns { dataUrl, width, height, bytes }.
 */
export async function prepareFlierImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image. Use a JPG or PNG.')
  }

  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  // Step quality down until it fits rather than guessing once.
  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_DATA_URL_BYTES) {
      return { dataUrl, width, height, bytes: dataUrl.length }
    }
  }
  throw new Error('That image is too large even after compressing. Try a smaller one.')
}

/** Attach a flier to a service. `image` comes from prepareFlierImage(). */
export async function setServiceFlier(serviceId, image, uploadedByUid) {
  await setDoc(doc(db, FLIERS, serviceId), {
    dataUrl:    image.dataUrl,
    width:      image.width,
    height:     image.height,
    uploadedAt: serverTimestamp(),
    uploadedBy: uploadedByUid || '',
  })
}

/** The flier for one service, or null. Safe to call from the public page. */
export async function getServiceFlier(serviceId) {
  if (!serviceId) return null
  const snap = await getDoc(doc(db, FLIERS, serviceId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function removeServiceFlier(serviceId) {
  await deleteDoc(doc(db, FLIERS, serviceId))
}
