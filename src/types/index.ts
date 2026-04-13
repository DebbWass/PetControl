import { Timestamp } from 'firebase/firestore';

// ─── User & Family ────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'member';

export interface NotificationPrefs {
  medications: boolean;
  vaccines: boolean;
  treatments: boolean;
  appointments: boolean;
  quietStart: string; // "HH:MM"
  quietEnd: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  familyId: string;
  role: UserRole;
  fcmTokens: string[];
  notificationPrefs: NotificationPrefs;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Family {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  inviteCode: string;
  createdAt: Timestamp;
}

// ─── Pet ──────────────────────────────────────────────────────────────────────

export type Species =
  | 'cat'
  | 'dog'
  | 'rabbit'
  | 'hamster'
  | 'guinea_pig'
  | 'chinchilla'
  | 'gerbil'
  | 'rat'
  | 'mouse'
  | 'parrot'
  | 'canary'
  | 'cockatiel'
  | 'budgie'
  | 'other_bird'
  | 'snake'
  | 'lizard'
  | 'turtle'
  | 'chameleon'
  | 'gecko'
  | 'other_reptile'
  | 'goldfish'
  | 'tropical_fish'
  | 'other_fish'
  | 'ferret'
  | 'hedgehog'
  | 'other';

export type Sex = 'male' | 'female' | 'unknown';

export interface Pet {
  id: string;
  familyId: string;
  name: string;
  species: Species;
  breed?: string;
  sex: Sex;
  birthdate?: Timestamp;
  isNeutered: boolean;
  photoUrl?: string;
  color?: string;
  microchipNumber?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Weight ───────────────────────────────────────────────────────────────────

export interface WeightRecord {
  id: string;
  petId: string;
  familyId: string;
  weightKg: number;
  recordedDate: Timestamp;
  notes?: string;
  recordedBy: string;
  createdAt: Timestamp;
}

// ─── Medication ───────────────────────────────────────────────────────────────

export type MedicationType = 'regular' | 'temporary' | 'supplement';
export type FrequencyUnit = 'hours' | 'daily' | 'weekly' | 'monthly' | 'as_needed';

export interface Medication {
  id: string;
  petId: string;
  familyId: string;
  name: string;
  type: MedicationType;
  dosage: string;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  administrationRoute?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  reminderEnabled: boolean;
  reminderTime?: string; // "HH:MM"
  reminderDays?: number[]; // 0=Sun..6=Sat
  notes?: string;
  isActive: boolean;
  nextDueDate?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Vaccine ──────────────────────────────────────────────────────────────────

export interface Vaccine {
  id: string;
  petId: string;
  familyId: string;
  name: string;
  vaccinationDate: Timestamp;
  nextDueDate?: Timestamp;
  batchNumber?: string;
  veterinarian?: string;
  clinic?: string;
  reminderEnabled: boolean;
  reminderDaysBeforeDue: number;
  notes?: string;
  documentUrl?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Treatment ────────────────────────────────────────────────────────────────

export type TreatmentCategory = 'deworming' | 'flea_tick' | 'heartworm' | 'lice' | 'other';

export interface Treatment {
  id: string;
  petId: string;
  familyId: string;
  category: TreatmentCategory;
  productName: string;
  treatmentDate: Timestamp;
  nextDueDate?: Timestamp;
  dosage?: string;
  reminderEnabled: boolean;
  reminderDaysBeforeDue: number;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Appointment ──────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  petId: string;
  familyId: string;
  title: string;
  veterinarian?: string;
  clinic?: string;
  clinicPhone?: string;
  scheduledDate: Timestamp;
  duration?: number;
  status: AppointmentStatus;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  notes?: string;
  completionNotes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Food ─────────────────────────────────────────────────────────────────────

export type FoodType = 'dry' | 'wet' | 'raw' | 'supplement' | 'treat' | 'other';

export interface FoodRecord {
  id: string;
  petId: string;
  familyId: string;
  foodBrand?: string;
  foodName: string;
  foodType: FoodType;
  amountGrams: number;
  feedingDate: Timestamp;
  notes?: string;
  recordedBy: string;
  createdAt: Timestamp;
}
