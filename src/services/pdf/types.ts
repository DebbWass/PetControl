/**
 * View models for the medical-file PDF report.
 *
 * Everything here uses plain `Date` rather than Firestore `Timestamp` so that
 * the HTML/SVG builders stay pure TypeScript and remain testable under the
 * `testEnvironment: "node"` jest config. Conversion happens in
 * `medicalReportData.ts`.
 */
import {
  AppointmentStatus,
  DocumentFileType,
  FoodType,
  FrequencyUnit,
  MedicationType,
  Sex,
  Species,
  TreatmentCategory,
} from '../../types';

/** Locale + formatting adapter injected into the pure builders. */
export interface ReportLabels {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (d: Date | null | undefined) => string;
  formatDateTime: (d: Date | null | undefined) => string;
  isRTL: boolean;
  lang: string;
}

export interface ReportPet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  sex: Sex;
  birthdate: Date | null;
  /** Pre-formatted via `formatAge` (needs i18n, so resolved in the data layer). */
  ageLabel: string | null;
  isNeutered: boolean;
  color?: string;
  microchipNumber?: string;
  /** base64 `data:` URI, or null when there is no photo / the fetch failed. */
  photoDataUri: string | null;
  isActive: boolean;
  deceased: boolean;
  deathDate: Date | null;
  createdAt: Date | null;
}

export interface ReportWeight {
  id: string;
  weightKg: number;
  date: Date | null;
  notes?: string;
}

export interface ReportMedication {
  id: string;
  name: string;
  type: MedicationType;
  dosage: string;
  dosageUnit?: string;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  administrationRoute?: string;
  startDate: Date | null;
  endDate: Date | null;
  nextDueDate: Date | null;
  reminderTimes: string[];
  notes?: string;
  isActive: boolean;
}

export interface ReportVaccine {
  id: string;
  name: string;
  vaccinationDate: Date | null;
  nextDueDate: Date | null;
  batchNumber?: string;
  veterinarian?: string;
  clinic?: string;
  notes?: string;
}

export interface ReportTreatment {
  id: string;
  category: TreatmentCategory;
  productName: string;
  treatmentDate: Date | null;
  nextDueDate: Date | null;
  dosage?: string;
  notes?: string;
}

export interface ReportAppointment {
  id: string;
  title: string;
  veterinarian?: string;
  clinic?: string;
  clinicPhone?: string;
  scheduledDate: Date | null;
  duration?: number;
  status: AppointmentStatus;
  notes?: string;
  completionNotes?: string;
}

export interface ReportFood {
  id: string;
  foodBrand?: string;
  foodName: string;
  foodType: FoodType;
  amountGrams: number;
  amountUnit?: string;
  feedingDate: Date | null;
  notes?: string;
}

export interface ReportDocument {
  id: string;
  name: string;
  fileType: DocumentFileType;
  uploadedAt: Date | null;
  notes?: string;
}

/** Food is capped — the report shows the newest `limit` of `totalCount`. */
export interface ReportFoodSection {
  records: ReportFood[];
  totalCount: number;
  limit: number;
}

export interface MedicalReportData {
  pet: ReportPet;
  familyName: string | null;
  generatedAt: Date;
  /** All sorted newest-first. */
  weights: ReportWeight[];
  /** Active *and* discontinued — partitioned by the builder. */
  medications: ReportMedication[];
  vaccines: ReportVaccine[];
  treatments: ReportTreatment[];
  appointments: ReportAppointment[];
  food: ReportFoodSection;
  documents: ReportDocument[];
}

/** Max food rows rendered in the table. */
export const FOOD_RECORD_LIMIT = 30;
