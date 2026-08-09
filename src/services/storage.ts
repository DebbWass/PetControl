import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { storage } from './firebase/config';

/**
 * Max width/height (px) for a stored pet profile photo. Profile photos are only
 * ever shown in a small avatar circle, so keeping full camera resolution
 * (often 2–3 MB) is pure wasted Storage space and download bandwidth on every
 * screen open. 512px keeps it crisp on any phone while cutting file size ~25–40×.
 */
const PROFILE_PHOTO_MAX_SIZE = 512;

/**
 * Downscale + re-encode a profile photo before upload.
 * NOTE: this is intentionally used ONLY for pet profile photos. Medical
 * documents (see medical-file.tsx) are uploaded at full resolution on purpose,
 * because X-rays and lab scans must stay diagnostically sharp.
 */
async function resizeProfilePhoto(localUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: PROFILE_PHOTO_MAX_SIZE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return result.uri;
}

/**
 * Upload a pet profile photo to Firebase Storage and return the download URL.
 * The photo is downscaled to at most PROFILE_PHOTO_MAX_SIZE px and stored as
 * JPEG at: families/{familyId}/pets/{petId}/photo.jpg
 */
export async function uploadPetPhoto(
  familyId: string,
  petId: string,
  localUri: string
): Promise<string> {
  const resizedUri = await resizeProfilePhoto(localUri);
  const response = await fetch(resizedUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `families/${familyId}/pets/${petId}/photo.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
