# PetControl – מודלי נתונים

**גרסה:** 1.0  
**תאריך:** 2026-04-13

---

## Family & User

```typescript
export type UserRole = 'owner' | 'member';

export interface User {
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

export interface NotificationPrefs {
  medications: boolean;
  vaccines: boolean;
  treatments: boolean;
  appointments: boolean;
  quiet_start: string; // "HH:MM"
  quiet_end: string;
}

export interface Family {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  inviteCode: string;
  createdAt: Timestamp;
}
```

---

## Pet

```typescript
export type Species =
  | 'cat' | 'dog'
  | 'rabbit' | 'hamster' | 'guinea_pig' | 'chinchilla' | 'gerbil' | 'rat' | 'mouse'
  | 'parrot' | 'canary' | 'cockatiel' | 'budgie' | 'other_bird'
  | 'snake' | 'lizard' | 'turtle' | 'chameleon' | 'gecko' | 'other_reptile'
  | 'goldfish' | 'tropical_fish' | 'other_fish'
  | 'ferret' | 'hedgehog'
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
```

---

## WeightRecord

```typescript
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
```

---

## Medication

```typescript
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
```

---

## Vaccine

```typescript
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
  reminderDaysBeforeDue: number; // ברירת מחדל: 30
  notes?: string;
  documentUrl?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Treatment (תילוע + פשפשים)

```typescript
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
  reminderDaysBeforeDue: number; // ברירת מחדל: 14
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Appointment

```typescript
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
  duration?: number; // minutes
  status: AppointmentStatus;
  reminderEnabled: boolean;
  reminderMinutesBefore: number; // 60, 1440, 2880
  notes?: string;
  completionNotes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## FoodRecord

```typescript
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
```

---

## Firestore Indexes נדרשים

```
Collection Group: medications
  - familyId ASC, nextDueDate ASC
  - petId ASC, isActive ASC, startDate DESC

Collection Group: vaccines
  - familyId ASC, nextDueDate ASC

Collection Group: treatments
  - familyId ASC, nextDueDate ASC

Collection Group: appointments
  - familyId ASC, scheduledDate ASC, status ASC
  - petId ASC, scheduledDate DESC

Collection Group: weights
  - petId ASC, recordedDate DESC

Collection Group: food
  - petId ASC, feedingDate DESC
```
