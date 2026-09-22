/**
 * Gathers everything the medical-file PDF needs, in one shot.
 *
 * Deliberately does NOT reuse `src/hooks/useHealthRecords.ts` – those are
 * live `onSnapshot` subscriptions, and `useMedications` filters to
 * `isActive == true`, while the report needs discontinued medications too.
 */
import { doc, getCountFromServer, getDoc, collection, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRecords, paths } from '../firebase/firestore';
import {
  Appointment,
  FoodRecord,
  MedicalDocument,
  Medication,
  Pet,
  Treatment,
  Vaccine,
  WeightRecord,
} from '../../types';
import { formatAge, toDate } from '../../utils/dateUtils';
import {
  FOOD_RECORD_LIMIT,
  MedicalReportData,
  ReportAppointment,
  ReportDocument,
  ReportFood,
  ReportMedication,
  ReportTreatment,
  ReportVaccine,
  ReportWeight,
} from './types';

/** Newest-first comparator tolerant of missing dates (they sort last). */
function byDateDesc<T>(pick: (item: T) => Date | null) {
  return (a: T, b: T) => {
    const da = pick(a);
    const dbb = pick(b);
    if (!da && !dbb) return 0;
    if (!da) return 1;
    if (!dbb) return -1;
    return dbb.getTime() - da.getTime();
  };
}

/**
 * Downloads the pet photo and inlines it as a base64 data URI so the PDF
 * renders identically offline. Returns null on any failure – a missing photo
 * must never fail the export.
 */
async function fetchPhotoDataUri(photoUrl: string | undefined): Promise<string | null> {
  if (!photoUrl) return null;
  try {
    // SDK 54 moved these helpers behind the /legacy entry point.
    const FS = require('expo-file-system/legacy');
    if (!FS?.cacheDirectory || typeof FS.downloadAsync !== 'function') return null;

    const target = `${FS.cacheDirectory}petcontrol-report-photo-${Date.now()}`;
    const { uri, status } = await FS.downloadAsync(photoUrl, target);
    if (status !== 200) return null;

    const base64 = await FS.readAsStringAsync(uri, { encoding: 'base64' });
    // Firebase Storage photos are uploaded as JPEG by `uploadPetPhoto`.
    const dataUri = `data:image/jpeg;base64,${base64}`;

    FS.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    return dataUri;
  } catch (err) {
    console.warn('[medicalReportData] photo inline failed', err);
    return null;
  }
}

async function fetchFamilyName(familyId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, paths.family(familyId)));
    return (snap.data()?.name as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Total food-record count. Uses an aggregate query so a pet with hundreds of
 * meals does not get fully downloaded; falls back to the fetched page size
 * when offline, since aggregate queries require a server round trip.
 */
async function fetchFoodCount(familyId: string, petId: string, fallback: number): Promise<number> {
  try {
    const snap = await getCountFromServer(collection(db, paths.food(familyId, petId)));
    return snap.data().count;
  } catch {
    return fallback;
  }
}

export async function collectMedicalReportData(
  familyId: string,
  pet: Pet
): Promise<MedicalReportData> {
  const petId = pet.id;

  const [weightsRaw, medsRaw, vaccinesRaw, treatmentsRaw, apptsRaw, foodRaw, docsRaw, familyName, photoDataUri] =
    await Promise.all([
      getRecords<WeightRecord>(paths.weights(familyId, petId)),
      getRecords<Medication>(paths.medications(familyId, petId)),
      getRecords<Vaccine>(paths.vaccines(familyId, petId)),
      getRecords<Treatment>(paths.treatments(familyId, petId)),
      getRecords<Appointment>(paths.appointments(familyId, petId)),
      getRecords<FoodRecord>(paths.food(familyId, petId), [
        orderBy('feedingDate', 'desc'),
        limit(FOOD_RECORD_LIMIT),
      ]),
      getRecords<MedicalDocument>(paths.documents(familyId, petId)),
      fetchFamilyName(familyId),
      fetchPhotoDataUri(pet.photoUrl),
    ]);

  const foodTotal = await fetchFoodCount(familyId, petId, foodRaw.length);

  const weights: ReportWeight[] = weightsRaw
    .map((r) => ({ id: r.id, weightKg: r.weightKg, date: toDate(r.recordedDate), notes: r.notes }))
    .sort(byDateDesc((r) => r.date));

  const medications: ReportMedication[] = medsRaw
    .map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      dosage: m.dosage,
      dosageUnit: m.dosageUnit,
      frequencyValue: m.frequencyValue,
      frequencyUnit: m.frequencyUnit,
      administrationRoute: m.administrationRoute,
      startDate: toDate(m.startDate),
      endDate: toDate(m.endDate),
      nextDueDate: toDate(m.nextDueDate),
      reminderTimes: m.reminderTimes?.length ? m.reminderTimes : m.reminderTime ? [m.reminderTime] : [],
      notes: m.notes,
      // Legacy documents predate the flag; treat a missing value as active.
      isActive: m.isActive !== false,
    }))
    .sort(byDateDesc((m) => m.startDate));

  const vaccines: ReportVaccine[] = vaccinesRaw
    .map((v) => ({
      id: v.id,
      name: v.name,
      vaccinationDate: toDate(v.vaccinationDate),
      nextDueDate: toDate(v.nextDueDate),
      batchNumber: v.batchNumber,
      veterinarian: v.veterinarian,
      clinic: v.clinic,
      notes: v.notes,
    }))
    .sort(byDateDesc((v) => v.vaccinationDate));

  const treatments: ReportTreatment[] = treatmentsRaw
    .map((t) => ({
      id: t.id,
      category: t.category,
      productName: t.productName,
      treatmentDate: toDate(t.treatmentDate),
      nextDueDate: toDate(t.nextDueDate),
      dosage: t.dosage,
      notes: t.notes,
    }))
    .sort(byDateDesc((t) => t.treatmentDate));

  const appointments: ReportAppointment[] = apptsRaw
    .map((a) => ({
      id: a.id,
      title: a.title,
      veterinarian: a.veterinarian,
      clinic: a.clinic,
      clinicPhone: a.clinicPhone,
      scheduledDate: toDate(a.scheduledDate),
      duration: a.duration,
      status: a.status,
      notes: a.notes,
      completionNotes: a.completionNotes,
    }))
    .sort(byDateDesc((a) => a.scheduledDate));

  const food: ReportFood[] = foodRaw
    .map((f) => ({
      id: f.id,
      foodBrand: f.foodBrand,
      foodName: f.foodName,
      foodType: f.foodType,
      amountGrams: f.amountGrams,
      amountUnit: f.amountUnit,
      feedingDate: toDate(f.feedingDate),
      notes: f.notes,
    }))
    .sort(byDateDesc((f) => f.feedingDate));

  const documents: ReportDocument[] = docsRaw
    .map((d) => ({
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      uploadedAt: toDate(d.uploadedAt),
      notes: d.notes,
    }))
    .sort(byDateDesc((d) => d.uploadedAt));

  return {
    pet: {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      birthdate: toDate(pet.birthdate),
      ageLabel: pet.birthdate ? formatAge(pet.birthdate) || null : null,
      isNeutered: !!pet.isNeutered,
      color: pet.color,
      microchipNumber: pet.microchipNumber,
      photoDataUri,
      isActive: pet.isActive !== false,
      deceased: !!pet.deceased,
      deathDate: toDate(pet.deathDate),
      createdAt: toDate(pet.createdAt),
    },
    familyName,
    generatedAt: new Date(),
    weights,
    medications,
    vaccines,
    treatments,
    appointments,
    food: { records: food, totalCount: Math.max(foodTotal, food.length), limit: FOOD_RECORD_LIMIT },
    documents,
  };
}
