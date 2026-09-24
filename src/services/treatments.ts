/**
 * Treatment follow-up actions — shared by the dashboard, the reminders tab and
 * the per-pet treatments screen.
 *
 * A treatment record with a `nextDueDate` is an open "next treatment" task.
 * Resolving it (done or not done) clears `nextDueDate`, which removes it from
 * the dashboard query and from the Cloud Function reminder scan.
 */
import {
  collection, doc, updateDoc, writeBatch, serverTimestamp, deleteField, Timestamp,
} from 'firebase/firestore';
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { db } from './firebase/config';
import { paths } from './firebase/firestore';
import { Treatment, TreatmentCategory } from '../types';

/** Default gap between treatments when the record gives no usable interval. */
export function defaultIntervalDays(category: TreatmentCategory): number {
  return category === 'deworming' ? 90 : 30;
}

/** Days between the treatment and its scheduled follow-up (falls back to category default). */
export function treatmentIntervalDays(tr: Treatment): number {
  if (tr.nextDueDate && tr.treatmentDate) {
    const days = differenceInCalendarDays(tr.nextDueDate.toDate(), tr.treatmentDate.toDate());
    if (days > 0) return days;
  }
  return defaultIntervalDays(tr.category);
}

/**
 * Mark the scheduled follow-up as performed on `doneDate`:
 * logs a new treatment record (same product/category/dosage) and schedules the
 * next one using the same interval; the original task is closed.
 */
export async function markTreatmentDone(
  familyId: string,
  tr: Treatment,
  uid: string,
  doneDate: Date = new Date(),
): Promise<void> {
  const colPath = paths.treatments(familyId, tr.petId);
  const nextDue = addDays(startOfDay(doneDate), treatmentIntervalDays(tr));
  const batch = writeBatch(db);

  const newRef = doc(collection(db, colPath));
  const newRecord: Record<string, unknown> = {
    petId: tr.petId,
    familyId,
    category: tr.category,
    productName: tr.productName,
    treatmentDate: Timestamp.fromDate(doneDate),
    nextDueDate: Timestamp.fromDate(nextDue),
    reminderEnabled: tr.reminderEnabled,
    reminderDaysBeforeDue: tr.reminderDaysBeforeDue ?? 7,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (tr.dosage) newRecord.dosage = tr.dosage;
  batch.set(newRef, newRecord);

  batch.update(doc(db, colPath, tr.id), {
    nextDueDate: deleteField(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/** Mark the scheduled follow-up as not performed — closes the task without logging a treatment. */
export async function dismissTreatmentDue(familyId: string, tr: Treatment): Promise<void> {
  await updateDoc(doc(db, paths.treatments(familyId, tr.petId), tr.id), {
    nextDueDate: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
