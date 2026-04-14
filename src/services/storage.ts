import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase/config';

/**
 * Upload a pet profile photo to Firebase Storage and return the download URL.
 * The photo is stored at: families/{familyId}/pets/{petId}/photo.{ext}
 */
export async function uploadPetPhoto(
  familyId: string,
  petId: string,
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const storageRef = ref(storage, `families/${familyId}/pets/${petId}/photo.${ext}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
