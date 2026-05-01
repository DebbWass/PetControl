/**
 * Generic Firestore CRUD helpers.
 * All pet-related data lives under families/{familyId}/pets/{petId}/...
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import { Pet, WeightRecord, Medication, Vaccine, Treatment, Appointment, FoodRecord, MedicalDocument } from '../../types';

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const paths = {
  family: (familyId: string) => `families/${familyId}`,
  members: (familyId: string) => `families/${familyId}/members`,
  pets: (familyId: string) => `families/${familyId}/pets`,
  pet: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}`,
  weights: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/weights`,
  medications: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/medications`,
  vaccines: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/vaccines`,
  treatments: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/treatments`,
  appointments: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/appointments`,
  food: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/food`,
  documents: (familyId: string, petId: string) => `families/${familyId}/pets/${petId}/documents`,
};

// ─── Pets ─────────────────────────────────────────────────────────────────────

export async function addPet(familyId: string, petData: Omit<Pet, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, paths.pets(familyId)), {
    ...petData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePet(familyId: string, petId: string, data: Partial<Pet>): Promise<void> {
  await updateDoc(doc(db, paths.pets(familyId), petId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function softDeletePet(familyId: string, petId: string): Promise<void> {
  await updateDoc(doc(db, paths.pets(familyId), petId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}

/** One-shot fetch of all active pets – used as a fallback / focus refresh.
 *  Filters client-side so pets missing the isActive field are still shown. */
export async function getPets(familyId: string): Promise<Pet[]> {
  const q = query(
    collection(db, paths.pets(familyId)),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Pet))
    .filter((p) => p.isActive !== false);
}

export function subscribeToPets(
  familyId: string,
  onUpdate: (pets: Pet[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, paths.pets(familyId)),
    orderBy('name')
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Pet))
        .filter((p) => p.isActive !== false)
    ),
    (err) => {
      console.error('[subscribeToPets]', err);
      onError?.(err);
    }
  );
}

// ─── Weight ───────────────────────────────────────────────────────────────────

export async function addWeight(
  familyId: string,
  petId: string,
  data: Omit<WeightRecord, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, paths.weights(familyId, petId)), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteWeight(familyId: string, petId: string, weightId: string): Promise<void> {
  await deleteDoc(doc(db, paths.weights(familyId, petId), weightId));
}

export function subscribeToWeights(
  familyId: string,
  petId: string,
  onUpdate: (records: WeightRecord[]) => void
) {
  const q = query(
    collection(db, paths.weights(familyId, petId)),
    orderBy('recordedDate', 'desc')
  );
  return onSnapshot(q, (snap) =>
    onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WeightRecord)))
  );
}

// ─── Generic sub-collection helper ───────────────────────────────────────────

/** Remove keys whose value is undefined – Firestore rejects undefined fields. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function addRecord<T>(
  collectionPath: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, collectionPath), {
    ...stripUndefined(data as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecord<T>(
  collectionPath: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  await updateDoc(doc(db, collectionPath, docId), {
    ...stripUndefined(data as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecord(collectionPath: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, collectionPath, docId));
}

export function subscribeToCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[],
  onUpdate: (items: T[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, collectionPath), ...constraints);
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T))),
    onError
  );
}
