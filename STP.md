# STP.md – Software Test Plan

**Project:** PetControl – Pet Health Management App for Families
**Platform:** Android (React Native + Expo Managed Workflow, SDK 54)
**Backend:** Firebase (Firestore, Authentication, Storage, Cloud Functions Gen 2)
**Document Type:** Manual Test Plan
**Language of Testing Documentation:** English
**Related Document:** [STR.md](STR.md) – Manual Test Specification (detailed test cases)

> This plan defines the **manual** testing strategy only. No automated test code, scripts, or CI pipelines are produced by this plan. All test cases referenced here are executed by a human QA engineer against a real Android device/emulator and, where relevant, against Firebase using manual tools (Firebase Console, browser DevTools, device logs).

---

## 1. Test Objectives

The manual testing effort aims to validate that PetControl:

1. Allows a user to register (creating a new family or joining an existing one via invite code), log in, and log out correctly.
2. Enforces **family-level data isolation** — a user can only see and modify data belonging to their own family.
3. Correctly performs CRUD operations for pets and all health sub-records (weights, medications, vaccines, treatments, appointments, food, medical documents).
4. Correctly auto-calculates `nextDueDate` for medications and vaccines and surfaces due/overdue items on the dashboard and reminders screens.
5. Schedules and cancels **local** notifications for medications and delivers **cloud** push reminders (FCM) for due items.
6. Handles the pet lifecycle: active → inactive (soft delete) → deceased → reactivated.
7. Correctly applies the **active / inactive / all** filter and excludes inactive/deceased pets from dashboards, reminders, and the AI context selector.
8. Presents all UI in Hebrew (RTL default) and English (LTR), switching language with an app restart.
9. Handles invalid input, empty states, network failures, and permission denials gracefully with user-facing messages.
10. Keeps the AI assistant server-side (API key never exposed to the client) and returns useful responses.

---

## 2. Scope

The following areas are **in scope** for manual testing:

| Area | Included |
|---|---|
| Authentication | Registration (create/join family), login, logout, "Remember Me", session persistence |
| Family management | Invite code generation, sharing, joining, membership isolation |
| Pets | Create, edit, photo upload, soft delete, mark deceased, reactivate, active/inactive/all filter |
| Health records | Medications, Vaccines, Treatments, Appointments, Weight, Food, Medical Documents |
| Dashboard & Reminders | Today / Upcoming (7 days) / Overdue grouping, mark-as-done, add-reminder flow |
| Due-date logic | `nextDueDate` auto-calculation, overdue advancement, mark-done advancement |
| Notifications | Local medication reminders, FCM token registration, cloud daily reminders, quiet hours, notification preferences |
| AI Assistant | Callable Cloud Function `askPetAI`, pet context, language handling, error handling |
| Settings | Language toggle + restart, notification preference toggles, invite code display/share, logout |
| i18n / RTL | Hebrew/English strings, RTL layout, localized date formatting |
| Security | Firestore rules (family isolation, member/family/user documents) |
| Data integrity | Persistence, offline cache/queue, cross-device sync between family members |
| Compatibility | Android versions, screen sizes, device vs. emulator behavior |

---

## 3. Out of Scope

| Excluded | Reason |
|---|---|
| iOS platform | The app is Android-only by design (see CLAUDE.md). No iOS-specific code exists. |
| Web platform behavior | Some code paths guard `Platform.OS === 'web'`, but web is not a supported production target; only smoke-level observation, not full coverage. |
| Automated/unit/integration test code | This is a **manual** test plan. Existing Jest unit tests (`medicationUtils.test.ts`, `petsStore.test.ts`) are noted but not authored or extended here. |
| Load / stress / performance benchmarking | Only manual, observational performance checks are included (see §24). |
| Penetration testing / destructive security testing | Only non-destructive manual security checks (access control, isolation) are included. |
| Firebase infrastructure SLAs | Availability of Firebase itself is assumed. |
| Payment / billing | The app has no payment flow. |
| Expo push proxy | Explicitly not used; only raw FCM is tested. |

---

## 4. System Overview

PetControl is a family-oriented pet health tracker. One user registers as the **Owner** and creates a **Family**, receiving a 6-character alphanumeric **invite code**. Additional members (e.g., a spouse) register with that code to join the same family. All pet and health data lives under `families/{familyId}` in Firestore and is shared across all members of the family.

Each family can hold unlimited pets. Each pet has a profile and seven health sub-areas: **Weight, Medications, Vaccines, Treatments, Appointments, Food, and Medical File (documents)**. The app computes upcoming and overdue tasks and surfaces them on a **Dashboard** (Home tab) and a **Reminders** tab. Reminders are delivered two ways: **local on-device notifications** (scheduled at exact reminder times for medications) and **cloud push notifications** (a daily Cloud Function that sends FCM messages to all family devices). An **AI Assistant** tab proxies questions to Claude via a callable Cloud Function.

---

## 5. Architecture Relevant to Testing

| Component | Testing Relevance |
|---|---|
| **Expo Router (file-based)** | Screen navigation and deep-linking (notification taps route to `/pet/{id}/...`). |
| **Zustand stores** (`authStore`, `petsStore`) | `authStore` holds the current `AppUser` + `Family`; `petsStore` holds the flat pet list. State clears on logout. |
| **Pets subscription** | `subscribeToPets` provides a real-time `onSnapshot` list; the Pets tab **also** re-fetches with a one-shot `getPets` on focus (fallback for missing indexes/slow sync). |
| **Health records fetching** | Sub-record screens use **real-time `onSnapshot`** subscriptions; the Dashboard uses **one-shot `getDocs` on focus** (no live subscription). |
| **Due-date logic** | `medicationUtils.calcMedicationNextDue` / `calcVaccineNextDue`; dashboard `advanceToCurrentDue` advances stale recurring meds to the current cycle. |
| **Local notifications** | `expo-notifications` DAILY triggers; per-medication ID map stored in AsyncStorage (`@petcontrol:med_notif_map`). Rescheduled fully at app boot in `NotificationBootstrapper`. |
| **Cloud notifications** | `sendDailyReminders` Cloud Function runs at 06:00 UTC (08:00 Asia/Jerusalem) daily; multicasts FCM; respects quiet hours and per-type notification prefs. |
| **AI** | `askPetAI` callable in region `europe-west1`; requires authentication; ANTHROPIC_API_KEY held as a server secret. |
| **Firestore Security Rules** | `isFamilyMember(familyId)` gates all reads/writes; families never deletable; invite-code list query allowed for any authenticated user. |
| **Firebase offline cache** | Firestore SDK provides automatic local cache + write queue when offline. |
| **i18n / RTL** | `I18nManager.forceRTL(true)` for Hebrew; language change requires `Updates.reloadAsync()` restart. |

---

## 6. Modules and Features Under Test

1. **Authentication & Session** — register (create family / join family), login, logout, remember me, auth-state redirect.
2. **Family** — invite code generation, invite code sharing, joining, cross-member data sharing/isolation.
3. **Pets** — list, filter (active/inactive/all), create, edit, photo upload, soft delete, mark deceased, reactivate, age display.
4. **Dashboard (Home)** — today/upcoming/overdue task cards, mark medication done, pet quick-access grid, greeting.
5. **Reminders** — grouped task lists, mark medication done, add-reminder dialog (route to medications/appointments).
6. **Medications** — CRUD, type (regular/temporary/supplement), frequency (hours/daily/weekly/monthly/as_needed), multi-dose reminder times, duration for temporary, smart reminder fields, nextDueDate computation, local notification scheduling.
7. **Vaccines** — CRUD, common vaccine lookup with intervals, auto vs. manual next-due, status color, reminder settings.
8. **Treatments** — add + list, category (flea_tick/deworming/other), next-treatment scheduling, reminder days.
9. **Appointments** — CRUD, status lifecycle (scheduled → completed / cancelled), date+time entry, reminder minutes before.
10. **Weight** — CRUD, line chart (last 10), trend (up/down/stable).
11. **Food** — CRUD (add/edit; no delete UI), type, amount + unit, weekly bar chart, today's total (gram-only).
12. **Medical File (Documents)** — upload image/PDF, list, open in browser, delete.
13. **AI Assistant** — chat, suggested questions, pet context selection, language, error handling, clear chat.
14. **Settings** — language toggle + restart prompt, notification preference toggles, invite code display + share, logout.
15. **Notifications** — local scheduling/cancellation, FCM registration, cloud daily reminders, quiet hours, deep-link on tap.
16. **i18n / RTL** — Hebrew default, English secondary, restart flow, localized dates.
17. **Security / Data Isolation** — Firestore rules enforcement across families and users.

---

## 7. Testing Strategy

Manual, risk-based, black-box testing driven by the actual implemented behavior, supplemented by grey-box verification against Firestore (via the Firebase Console) and device logs. The strategy prioritizes:

1. **Critical business flows first** (registration → add pet → add medication with reminder → see it on dashboard → receive notification).
2. **Data isolation and security** (a member of Family A must never see Family B's data).
3. **Due-date correctness** (the single most error-prone logic area — auto-calculation, overdue advancement, mark-done).
4. **Negative and boundary conditions** on every input form.
5. **Cross-member synchronization** using two devices/accounts sharing one family.

Each test case is written so a tester can execute the steps and record a binary **PASS/FAIL** with an observed result. Grey-box checks (reading Firestore documents) are used to confirm that the persisted data matches the UI.

---

## 8. Test Levels

- **Component-level manual validation** — individual screens/forms (e.g., the Add Medication dialog) validated in isolation.
- **Integration Testing** — client ↔ Firestore, client ↔ Storage, client ↔ Cloud Functions (AI + scheduled reminders), notifications pipeline.
- **System Testing** — the full app on a device with a real Firebase backend.
- **End-to-End Testing** — complete user journeys spanning multiple screens and both family members.
- **Acceptance Testing** — validation that the sprint-completed features (auth, health records, notifications, dashboard, AI) meet the described product behavior.

---

## 9. Functional Testing

Validate normal, expected behavior for every module: successful create/read/update/delete, correct list ordering, correct labels and localized strings, state transitions (appointment status, pet active/inactive/deceased), and correct dashboard grouping. Detailed cases in STR §Functional.

---

## 10. UI Testing

Verify: Material Design 3 (React Native Paper) rendering; RTL layout in Hebrew; FAB placement and behavior; dialogs/portals opening and dismissing; segmented buttons and menus; species emoji fallbacks; photo circles/avatars; empty-state messages; loading indicators; chart rendering (weight line chart, food bar chart); Android navigation bar hidden (immersive mode) reappearing on swipe.

---

## 11. Validation Testing

Verify field-level validation: required fields (name, dosage, weight, food name/amount, document name+file), numeric parsing (birth year, frequency, duration, weight with comma/period decimal), date parsing (`DD/MM/YYYY`), time parsing (`HH:MM`), invite code required and normalized to uppercase, message length cap (AI input maxLength 1000).

---

## 12. Negative Testing

Verify graceful handling of: empty/whitespace required fields, invalid email/password on login, wrong password, non-existent invite code, invalid date/time strings, zero/negative weight and amounts, non-numeric numeric fields, joining with an already-used account, and actions taken while offline.

---

## 13. Boundary Testing

Verify boundaries relevant to the implementation:
- Birth year (4-digit `maxLength`, future year, year 0000).
- Frequency value (1, large values), duration value.
- Monthly reminder day clamped to **1–31** (values <1 or >31).
- Weekly reminder day index (Sunday=0 … Saturday=6).
- Weight chart requires **≥2** records to render; chart uses last **10** records.
- Reminder day-before ranges (default 30 for vaccines, 7 for treatments).
- Quiet-hours boundary (period wrapping midnight, e.g., 22:00–08:00).
- AI input at 0, 1, 1000, and >1000 characters (cap).

---

## 14. Edge Case Testing

Verify: pet with missing/null name (must still appear and sort last); species not in map (falls back to 🐾); medication with `as_needed` (no nextDueDate, no local notification); daily medication whose reminder time is later today (scheduled for today, appears in "today"); very old recurring medication (advanced forward to current cycle, not stuck in overdue); duplicate rapid saves (double-tap Save); deceased pet excluded from active views; reactivating a deceased pet clears death metadata; document picker library missing (expo-document-picker) → informative alert.

---

## 15. Error Handling Testing

Verify user-facing behavior for: Firestore write failure (error string shown in `HelperText`), photo/document upload failure, AI Cloud Function failure or not-deployed (error bubble in chat), network loss during save (offline queue), permission denial for notifications (silent skip), and simulator/no-device token registration returning null.

---

## 16. API Testing (Manual)

The app has no REST API, but two **callable/scheduled Cloud Functions** and the **Firestore SDK** are the effective API surface:

- **`askPetAI` (HTTPS callable, europe-west1)** — verify manually via the app: authentication requirement (unauthenticated → error), required `message`, correct language response (he/en), pet context inclusion, and error propagation. If direct invocation is needed, use the Firebase Emulator/Console callable tester manually.
- **`sendDailyReminders` (scheduled)** — verify manually by triggering the function in the Firebase Console (or waiting for the 06:00 UTC run) and observing FCM delivery, quiet-hour suppression, and per-type preference gating.
- **Firestore reads/writes** — verify via Firebase Console that documents created in the app match expected schema and paths.

No API automation code is produced.

---

## 17. Database Testing (Manual)

Using the **Firebase Console (Firestore)** as the manual DB client, verify:
- Documents are created at the correct paths (`families/{familyId}/pets/{petId}/...`).
- `serverTimestamp()` fields (`createdAt`, `updatedAt`) populate.
- `undefined` fields are stripped (never written) by `stripUndefined`.
- Soft delete sets `isActive=false` (document is **not** removed).
- `markPetDeceased` sets `deceased=true`, `deathDate`, `isActive=false`.
- `reactivatePet` sets `isActive=true`, `deceased=false`, and **deletes** the `deathDate` field.
- `nextDueDate` values match the computed due dates.
- Referential consistency: sub-records carry the correct `petId`/`familyId`.
- Families are never deleted (rule `allow delete: if false`).

---

## 18. Integration Testing

Verify integration points: Client ↔ Firestore (CRUD + real-time), Client ↔ Firebase Auth (register/login/logout), Client ↔ Firebase Storage (photo & document upload/download), Client ↔ Cloud Functions (AI callable), Cloud Function ↔ Firestore + FCM (daily reminders), and Local Notifications ↔ AsyncStorage map. Cross-member sync (two accounts, one family) validates the Firestore integration end to end.

---

## 19. End-to-End Testing

Critical journeys (detailed in STR §E2E):
1. **New owner onboarding** → register (create family) → add pet → add medication with reminder → see task on dashboard → receive local notification → mark done.
2. **Member joining** → owner shares code → member registers with code → member sees the same pets/records.
3. **Vaccine lifecycle** → add vaccine with auto next-due → appears in reminders as it approaches → cloud reminder within days-before window.
4. **Pet passing** → mark deceased → pet leaves active views/dashboard → appears under Inactive filter → reactivate.
5. **Appointment lifecycle** → schedule → appears in upcoming → mark completed/cancelled → leaves reminders.
6. **Language switch** → toggle to English → restart → all screens localized and LTR.

---

## 20. Authentication Testing

Verify: create-family registration, join-family registration (valid & invalid code), login (valid, wrong password, unknown email, empty fields), "Remember Me" persistence and clearing, auto-login on relaunch (auth state listener), redirect to login on logout, and cleanup of a dangling auth account when family-join fails (`registerAndJoinFamily` deletes the auth user on error).

---

## 21. Authorization Testing

Verify Firestore rules manually:
- A user cannot `get` another family's document (must be a member).
- A user cannot read/write pets or sub-records of a family they do not belong to.
- A user can only create/update/delete **their own** member document, and only while a family member.
- The `families` **list** query is permitted for any authenticated user (needed for invite-code lookup) but **get** is restricted to members.
- Non-member self-join update is allowed only when it strictly adds the user to `memberUids` without altering `inviteCode`/`ownerUid`.

Authorization is verified by attempting cross-family access using a second test account (grey-box, non-destructive).

---

## 22. Security Testing (Manual, Non-Destructive)

- **Data isolation** between families (primary security property).
- **Session handling** — logout clears store and redirects; relaunch requires valid auth.
- **Sensitive data exposure** — the ANTHROPIC API key must never be present in client code or network payloads; AI calls go through the callable function only.
- **Credential storage** — "Remember Me" stores email+password in AsyncStorage in plain text; document this as a security risk (see §34 Risks).
- **Information leakage** — verify error messages do not expose stack traces or internal identifiers to the user.
- **Invite code** — confirm codes are 6-char uppercase and that guessing a wrong code is rejected.

No injection/exploit or destructive testing is performed.

---

## 23. Data Integrity Testing

Verify: data persists across app restarts; edits update `updatedAt`; deleting a weight/vaccine/medication/document removes it from the list and from Firestore; soft-deleted pets retain all sub-records; mark-done advances `nextDueDate` by exactly one frequency interval preserving the reminder time; offline writes queue and later sync without duplication or loss.

---

## 24. Performance Testing Considerations (Manual Only)

Observational checks only:
- Dashboard load time with many pets/records (one-shot fetch across all active pets).
- Real-time list responsiveness on sub-record screens.
- Photo/document upload time and UI responsiveness (loading indicators).
- Notification scheduling time at app boot with many active medications.
- Chart rendering performance with the maximum considered records.

No automated load testing is performed.

---

## 25. Compatibility Testing

| Dimension | To Verify |
|---|---|
| Android version | Minimum supported Android and a current Android version. |
| Device vs. emulator | Push token registration requires a **physical device** (`Device.isDevice`); notifications behavior differs on emulator. |
| Screen sizes | Small phone, large phone; FAB/dialog/chart layouts; long pet names truncation. |
| Language / direction | Hebrew (RTL) and English (LTR). |
| Locale date rendering | `date-fns` Hebrew vs. English locale formatting. |
| Google Play Services | Required for FCM push delivery. |

---

## 26. Smoke Testing

Minimal build-acceptance set: app launches, login screen appears, valid login succeeds, Home/Pets/Reminders/AI/Settings tabs open, add a pet succeeds, logout works. (See STR §Smoke.)

---

## 27. Sanity Testing

After a change to a specific area (e.g., medications), a focused re-check that the core of that area still works (add/edit/delete medication, reminder scheduling, dashboard reflection) without a full regression.

---

## 28. Regression Testing

After any change, re-run: authentication, add/edit pet, all seven health record types (add + persist), dashboard grouping, notification scheduling, language switch, and data isolation. The coverage matrix in STR guides regression selection.

---

## 29. Exploratory Testing

Time-boxed charters:
- "Break the Add Medication form" (frequency/reminder combinations, multi-dose edge values).
- "Pet lifecycle chaos" (rapid delete/deceased/reactivate cycles).
- "Offline everything" (create/edit records offline, then reconnect).
- "Two members racing" (both edit the same record simultaneously).
- "Date/time boundaries" (past dates, far-future dates, month-end reminder days).

---

## 30. Recovery and Resilience Testing

Verify: the app recovers after network loss during save (queued write completes on reconnect); token registration retried on next launch when Firestore save fails; medication notifications fully rescheduled at boot (self-healing map); AI errors do not crash the chat (error bubble); a failed family-join cleans up the auth account so the user can retry.

---

## 31. Test Environment

| Item | Value |
|---|---|
| App | PetControl APK (preview/production EAS build) or Expo dev client |
| Devices | ≥1 physical Android device (for notifications/FCM) + optional emulator |
| Backend | A dedicated Firebase **test** project (Firestore, Auth, Storage, Functions) |
| Functions | `askPetAI` and `sendDailyReminders` deployed to `europe-west1`; `ANTHROPIC_API_KEY` secret set |
| Tools | Firebase Console, Android logcat / device logs, a second Android device or account for isolation/cross-member tests |
| Network | Controllable connectivity (airplane mode toggling) for offline tests |

---

## 32. Test Data

- **Two families** (Family A, Family B) with at least one owner each; one family with two members (owner + spouse) sharing a code.
- **Pets** covering multiple species (cat, dog, an exotic like snake, and `other`), one with a photo, one without, one with a missing name (via console), plus one to be marked deceased.
- **Medications** covering each frequency (hours, daily ×1, daily ×N multi-dose, weekly, monthly, as_needed) and each type (regular, temporary, supplement).
- **Vaccines** using a known common vaccine (auto next-due) and "Other" (manual next-due).
- **Treatments, appointments, weights, food, documents** with representative and boundary values.
- Dates spanning **past (overdue), today, and near-future (≤7 days)** to exercise dashboard grouping.

---

## 33. Dependencies

- Firebase project availability and correctly deployed security rules, indexes, and functions.
- Google Play Services on the device for FCM.
- `ANTHROPIC_API_KEY` secret configured for the AI function.
- `expo-document-picker` installed for PDF selection (graceful fallback if missing).
- Composite Firestore indexes for dashboard queries (vaccines/treatments/appointments ordered by date).

---

## 34. Risks

| Risk | Impact | Notes |
|---|---|---|
| "Remember Me" stores password in plaintext (AsyncStorage) | High (security) | Credentials recoverable from device storage. Flag for product decision. |
| Missing composite indexes | Medium | Dashboard vaccine/treatment/appointment queries `orderBy` + range may fail without indexes; code swallows errors (`catch { skip }`), silently hiding tasks. |
| Dashboard uses one-shot fetch on focus | Medium | New records may not appear until the tab is refocused. |
| Local notifications rely on device (not on emulator) | Medium | Cannot be validated on emulator; requires physical device. |
| Cloud AI model id / key misconfig | Medium | `askPetAI` fails if secret/model unavailable; user sees error bubble. |
| Time zone handling | Medium | Cloud reminders run Asia/Jerusalem; local due-date logic uses device time; mismatches possible for travelers. |
| Food records have no delete UI | Low | Only add/edit exposed; erroneous entries cannot be removed in-app. |
| Silent error swallowing in save flows | Low/Medium | Several `.catch(() => {})` may hide failures from the tester; verify via Firestore. |

---

## 35. Assumptions

- Firebase backend is correctly provisioned for the test project.
- Testers have access to the Firebase Console for grey-box verification.
- At least one physical Android device is available.
- Cloud Functions are deployed and the AI secret is set.
- The tester can create multiple accounts/emails for isolation and cross-member testing.

---

## 36. Entry Criteria

- A runnable build (APK or dev client) is available and installs successfully.
- Firebase test project is configured with rules, indexes, and functions deployed.
- Test accounts and seed data can be created.
- This STP and STR are reviewed and approved.

---

## 37. Exit Criteria

- All **Critical** and **High** priority test cases in STR are executed.
- No open **Critical** or **High** severity defects remain.
- All primary E2E journeys pass.
- Data isolation (security) tests pass with no cross-family leakage.
- Known limitations/risks are documented and accepted by the product owner.

---

## 38. Defect Management

Each defect record should include: Title, related Test Case ID, Severity (Critical/High/Medium/Low), Priority, Environment (device, OS, build, language), Preconditions, Steps to Reproduce, Expected vs. Actual result, screenshots/log excerpts, and Firestore document evidence where relevant. Defects are triaged and re-verified after fixes; regression is run on the affected module.

**Severity guidance:**
- **Critical** — data loss, cross-family data leakage, crash on core flow, auth broken.
- **High** — a core feature unusable (cannot add medication, reminders never fire).
- **Medium** — incorrect but recoverable behavior (wrong due date, missing localization).
- **Low** — cosmetic/UI, minor copy issues.

---

## 39. Test Prioritization

1. **P1 (Critical):** Authentication, family isolation/security, add pet, add medication + due date, data persistence.
2. **P2 (High):** Vaccines/treatments/appointments CRUD + due dates, dashboard/reminders grouping, notifications, cross-member sync.
3. **P3 (Medium):** Weight/food charts, medical documents, AI assistant, settings, language switch.
4. **P4 (Low):** Cosmetic/UI, empty states, copy, exploratory polish.

---

## 40. Quality Gates

- **Gate 1 (Smoke):** Smoke suite passes on a fresh build → testing continues.
- **Gate 2 (Functional):** All P1 + P2 functional cases pass; no open Critical/High defects.
- **Gate 3 (Integration/E2E):** All E2E journeys and isolation tests pass.
- **Gate 4 (Release):** Exit criteria (§37) met; risks reviewed and signed off.

---

## Traceability

Each STR test case maps to a Module → Feature → Business Behavior. The **Coverage Matrix** in [STR.md](STR.md) provides the module-by-category traceability overview. No formal external requirements repository exists; traceability is derived from the implemented features described in this plan.
