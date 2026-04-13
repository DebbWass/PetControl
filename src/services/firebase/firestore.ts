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
import { Pet, WeightRecord, Medication, Vaccine, Treatment, Appointment, FoodRecord } from '../../types';

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

export function subscribeToPets(
  familyId: string,
  onUpdate: (pets: Pet[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, paths.pets(familyId)),
    where('isActive', '==', true),
    orderBy('name')
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pet))),
    onError
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

export async function addRecord<T>(
  collectionPath: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, collectionPath), {
    ...data,
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
    ...data,
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
