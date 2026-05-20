# CLAUDE.md – PetControl

Pet health management app for families. Android-only, React Native + Expo + Firebase.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native + Expo (Managed Workflow) | SDK 54 |
| Language | TypeScript | ~5.9 |
| Routing | Expo Router (file-based) | ~6.0 |
| State | Zustand | ^5.0 |
| UI | React Native Paper (Material Design 3) | ^5.15 |
| DB | Firebase Firestore | ^12 |
| Auth | Firebase Authentication (email/password) | ^12 |
| Storage | Firebase Storage | ^12 |
| Push | Expo Notifications + FCM (raw, not Expo proxy) | ~0.32 |
| Cloud Functions | Firebase Cloud Functions TypeScript (Gen 2) | — |
| i18n | i18next + react-i18next | ^26 / ^17 |
| Charts | react-native-chart-kit | ^6.12 |

---

## Project Structure

```
app/                        # Expo Router screens (file-based routing)
  _layout.tsx               # Root layout – auth guard
  (tabs)/                   # Tab navigator (index, pets, reminders, settings)
  auth/                     # login, register
  pet/
    new.tsx                 # Create pet form
    [id].tsx                # Pet profile
    [id]/                   # Per-pet sub-screens
      medications.tsx | vaccines.tsx | treatments.tsx
      appointments.tsx | food.tsx | weight.tsx

src/
  types/index.ts            # All shared TypeScript interfaces (Pet, Medication, etc.)
  constants/
    colors.ts               # Theme colors
    species.ts              # Species enum (26+ types)
    vaccines.ts             # Common vaccine lookup with booster intervals
  i18n/index.ts             # i18next setup, he + en namespaces
  services/
    firebase/
      config.ts             # Firebase app init
      auth.ts               # Auth helpers (login, register, invite flow)
      firestore.ts          # Firestore CRUD helpers
    notifications.ts        # FCM token registration + local reminder scheduling
    storage.ts              # uploadPetPhoto to Firebase Storage
  hooks/
    usePets.ts              # Zustand-backed pets hook
    useHealthRecords.ts     # useMedications, useVaccines, useTreatments, useFood, useWeights
    useDashboard.ts         # DashboardData: today / upcoming7 / overdue
  store/
    authStore.ts            # Zustand: AppUser + familyId
    petsStore.ts            # Zustand: Pet[]
  utils/
    dateUtils.ts            # date-fns helpers
    medicationUtils.ts      # calcMedicationNextDue, calcVaccineNextDue

functions/src/index.ts      # Cloud Function: sendDailyReminders (07:00 daily)

firestore.rules             # Security rules – family-scoped, isFamilyMember()
firestore.indexes.json      # Composite indexes
eas.json                    # EAS build profiles (development, preview, production)
```

---

## Development Commands

```bash
# Start Metro bundler
npm start

# Run on Android device/emulator
npm run android

# TypeScript type check (no emit)
npx tsc --noEmit

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions
cd functions && npm run build && firebase deploy --only functions

# EAS build – Android APK (preview)
eas build -p android --profile preview
```

---

## Firestore Data Model

All data lives under `families/{familyId}`. Security rules enforce family isolation.

```
families/{familyId}
  members/{userId}          # AppUser profile + fcmTokens + notificationPrefs
  pets/{petId}
    weights/{weightId}
    medications/{medicationId}
    vaccines/{vaccineId}
    treatments/{treatmentId}
    appointments/{appointmentId}
    food/{foodId}

users/{userId}              # Top-level index: uid → familyId (login lookup)
```

**Security rules** (`firestore.rules`): `isFamilyMember(familyId)` checks `request.auth.uid in families/{familyId}.memberUids`. Families are never deleted.

---

## Key Architectural Patterns

### Data fetching
- Dashboard and pet screens use **one-shot `getDocs`** on screen focus — no real-time subscriptions.
- Firestore SDK provides automatic local cache + offline queue (no extra setup needed).

### State management
- `authStore` holds `AppUser` and `familyId`.
- `petsStore` holds the flat `Pet[]` list.
- Health sub-records (medications, vaccines, etc.) are fetched on demand via hooks, not stored globally.

### Notifications – two layers
1. **Local** (`expo-notifications`): scheduled on-device at the exact `reminderTime` the user entered.
   - `scheduleOneMedicationReminder(med)` — called immediately after save/update in `medications.tsx`. Uses a per-medication map in AsyncStorage (`@petcontrol:med_notif_map`) so changing one medication never disrupts others.
   - `cancelMedicationReminder(medId)` — called before `deleteRecord` in `medications.tsx`.
   - `scheduleLocalMedicationReminders(meds[])` — full reschedule at app boot inside `NotificationBootstrapper` in `_layout.tsx` (fires whenever `user` + `pets` are available).
   - Supports both single `reminderTime` and multi-dose `reminderTimes[]` — each time slot gets its own daily DAILY-trigger notification.
2. **Cloud** (`functions/src/index.ts`): Cloud Scheduler → Firebase Function → FCM multicast to all family members' devices, daily at 07:00.

### FCM tokens
Use `getDevicePushTokenAsync()` (raw FCM token). Tokens are stored in `families/{familyId}/members/{uid}.fcmTokens[]` to support multiple devices per user.

---

## i18n and RTL

- Default language: **Hebrew (RTL)**. Secondary: English (LTR).
- `I18nManager.forceRTL(true)` called at app startup when language is Hebrew.
- Changing language in Settings requires an app restart (prompt is shown to user).
- Date formatting uses `date-fns/locale/he` for Hebrew.
- All UI strings go through `i18next` — no hardcoded Hebrew/English strings in components.

---

## Family & Auth Flow

- **Owner** registers → creates `families/{id}` → receives 6-char alphanumeric `inviteCode`.
- **Member** (spouse) registers with `inviteCode` → added to existing family.
- Unlimited pets per family.

---

## Important Constraints

- **Android only** — no iOS support. Do not add iOS-specific code.
- **Species enum** has 26+ values — do not reduce it. See `src/constants/species.ts`.
- **Food tracking** is separate from health records (different Firestore sub-collection).
- `nextDueDate` on medications and vaccines is **auto-calculated** by `medicationUtils.ts` — do not set it manually from screens.
- Never use Expo push proxy — always use raw FCM tokens.

---

## Remaining Pre-Production Steps

```bash
eas login && eas build:configure          # generates EAS projectId in app.json
cd functions && npm run build && firebase deploy --only functions
eas build -p android --profile preview    # generates APK
# add assets/notification-icon.png if missing
```

---

## Sprints Completed

| Sprint | Scope |
|---|---|
| 1 | Foundation: auth, Firestore, navigation, Zustand |
| 2 | Health records: medications, vaccines, treatments, food, weight + nextDueDate calc |
| 3 | Push notifications: FCM registration, local reminders, Cloud Function daily scheduler |
| 4 | Dashboard (today/upcoming/overdue), pet photo upload, settings + language restart |
| 5 | EAS build config, app version 1.2.0, Firestore indexes |
