# STR.md – Manual Test Specification (Software Test Requirements)

**Project:** PetControl – Pet Health Management App for Families
**Platform:** Android (React Native + Expo SDK 54) + Firebase
**Document Type:** Manual Test Cases (human-executable)
**Language:** English
**Related Document:** [STP.md](STP.md) – Software Test Plan

> All test cases below are **manual**. A tester executes the steps on an Android device/emulator (and, where noted, verifies data in the Firebase Console) and records **PASS** or **FAIL** based on the Expected Result. No automation code is implied.
>
> **Default preconditions (unless a case states otherwise):** the app is installed and launched, the Firebase test project is configured, and the tester is logged in as the **Owner** of a family that already contains at least one **active** pet named "TestPet".

---

## Test Case ID Convention

`TC-<MODULE>-<TYPE>-<NNN>`

- **MODULE:** AUTH, FAM, PET, DASH, REM, MED, VAC, TRT, APT, WGT, FOOD, DOC, AI, SET, NOTIF, I18N, SEC, DATA, E2E, SMOKE
- **TYPE:** FUNC (functional), NEG (negative), BOUND (boundary), EDGE (edge case), ERR (error handling), INT (integration), UI, VAL (validation)

Priority: **P1** Critical · **P2** High · **P3** Medium · **P4** Low
Severity if failed: **Critical / High / Medium / Low**

---

## Coverage Matrix

| Module | Feature | Functional | Negative | Boundary | Edge | Integration | E2E | Auth/Authz | Data | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Authentication | Register / Login / Logout | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Covered |
| Family | Invite code / Join / Isolation | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Covered |
| Pets | CRUD / Filter / Lifecycle | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Dashboard | Today/Upcoming/Overdue/Mark-done | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Reminders | Grouping / Add-reminder | ✔ | – | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Medications | CRUD / Frequency / Reminders / Due | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Vaccines | CRUD / Auto-due / Lookup | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Treatments | Add / Category / Next-due | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Appointments | CRUD / Status lifecycle | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Covered |
| Weight | CRUD / Chart / Trend | ✔ | ✔ | ✔ | ✔ | ✔ | – | N/A | ✔ | Covered |
| Food | Add/Edit / Chart / Totals | ✔ | ✔ | ✔ | ✔ | ✔ | – | N/A | ✔ | Partially (no delete) |
| Medical File | Upload / Open / Delete | ✔ | ✔ | ✔ | ✔ | ✔ | – | N/A | ✔ | Covered |
| AI Assistant | Chat / Context / Errors | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | N/A | Covered |
| Settings | Language / Prefs / Share | ✔ | – | – | ✔ | ✔ | – | N/A | ✔ | Covered |
| Notifications | Local / Cloud / Quiet hours | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | N/A | ✔ | Partially (device-dependent) |
| i18n / RTL | Hebrew / English / Restart | ✔ | – | – | ✔ | – | ✔ | N/A | – | Covered |
| Security | Firestore rules / Isolation | ✔ | ✔ | – | ✔ | ✔ | ✔ | ✔ | ✔ | Covered |

Legend: ✔ Covered · – Not applicable / not separately covered · N/A Not applicable to module.

---

# 1. Authentication Module (AUTH)

## 1.1 Registration – Create Family

### TC-AUTH-FUNC-001 — Register a new owner and create a family
- **Priority:** P1 · **Severity:** Critical · **Type:** Functional / Positive / Happy Path
- **Preconditions:** Logged out; on the Login screen.
- **Test Data:** email `owner1@test.com`, password `Passw0rd!`, display name `Alice`, family name `Alice Family`.
- **Steps:**
  1. Tap "No account? Register".
  2. Ensure the "Create family" segment is selected.
  3. Enter display name, email, password, and family name.
  4. Tap the create button.
- **Expected Result:** Registration succeeds; the user is redirected to the Home tab; greeting shows "…Alice". In Firebase Console: a `families/{id}` doc exists with `ownerUid` = the new uid, `memberUids` containing the uid, and a 6-char uppercase `inviteCode`; a `families/{id}/members/{uid}` doc with `role: "owner"` and default `notificationPrefs`; a `users/{uid}` doc with `familyId`.

### TC-AUTH-NEG-001 — Register with missing required fields
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative
- **Steps:** On Register (create mode), leave display name (or email/password/family name) empty and tap create.
- **Expected Result:** An error message (`common.required`) is shown; no account is created; no navigation occurs.

### TC-AUTH-NEG-002 — Register with an already-registered email
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Error Handling
- **Test Data:** an email already used by an existing account.
- **Steps:** Complete the create-family form with the existing email; tap create.
- **Expected Result:** A Firebase auth error message is displayed (e.g., email already in use); the user stays on the Register screen; no duplicate family created.

### TC-AUTH-BOUND-001 — Password below Firebase minimum length
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary / Negative
- **Test Data:** password `123` (below 6 chars).
- **Steps:** Attempt create-family registration with a too-short password.
- **Expected Result:** Firebase rejects with a weak-password error shown to the user; no account created.

## 1.2 Registration – Join Family

### TC-AUTH-FUNC-002 — Register and join an existing family via valid invite code
- **Priority:** P1 · **Severity:** Critical · **Type:** Functional / Integration
- **Preconditions:** Family A exists with a known invite code (from Settings of the owner).
- **Test Data:** email `member1@test.com`, password `Passw0rd!`, name `Bob`, the valid invite code.
- **Steps:**
  1. On Register, select the "Join" segment.
  2. Enter name, email, password, and the invite code (any case).
  3. Tap the join button.
- **Expected Result:** Registration succeeds; user lands on Home. In Firestore: the family's `memberUids` now includes Bob's uid; a member doc with `role: "member"`; `users/{uid}` maps to the same familyId. Bob sees Family A's pets.

### TC-AUTH-NEG-003 — Join with an invalid/non-existent invite code
- **Priority:** P1 · **Severity:** High · **Type:** Negative / Error Handling / Recovery
- **Test Data:** invite code `ZZZZZZ` (not assigned).
- **Steps:** Complete join-mode registration with the invalid code; tap join.
- **Expected Result:** Error message for invalid code (`family.invalidCode`) is shown; the dangling auth account is deleted (the same email can be re-registered afterward); no member doc created.

### TC-AUTH-EDGE-001 — Invite code entered in lowercase / mixed case
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge
- **Steps:** Join using the valid code typed in lowercase.
- **Expected Result:** Join succeeds (the code is normalized to uppercase before lookup).

## 1.3 Login

### TC-AUTH-FUNC-003 — Login with valid credentials
- **Priority:** P1 · **Severity:** Critical · **Type:** Functional / Happy Path
- **Test Data:** valid registered email + password.
- **Steps:** On Login, enter email and password; tap Login.
- **Expected Result:** User is authenticated and redirected to Home; the correct display name greeting appears; the family's pets load.

### TC-AUTH-NEG-004 — Login with wrong password
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative
- **Steps:** Enter a valid email with an incorrect password; tap Login.
- **Expected Result:** An error message is shown; the user remains on Login; not authenticated.

### TC-AUTH-NEG-005 — Login with empty fields
- **Priority:** P3 · **Severity:** Low · **Type:** Negative / Validation
- **Steps:** Leave email and/or password empty; tap Login.
- **Expected Result:** `common.required` error is shown; no network call.

### TC-AUTH-NEG-006 — Login with an account that has no family index
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Error Handling
- **Preconditions:** An auth account exists but its `users/{uid}` doc is missing (simulate via console deletion).
- **Steps:** Log in with that account.
- **Expected Result:** Load fails (`USER_NOT_IN_ANY_FAMILY`); the auth listener clears state and redirects back to Login (user is not stranded on a broken Home).

### TC-AUTH-EDGE-002 — Email with surrounding whitespace
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Enter `  owner1@test.com  ` (leading/trailing spaces) with the correct password; tap Login.
- **Expected Result:** Login succeeds (email is trimmed before submission).

## 1.4 Remember Me & Session

### TC-AUTH-FUNC-004 — "Remember Me" persists credentials
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** On Login, check "Remember Me", log in, log out, return to Login.
- **Expected Result:** Email and password fields are pre-filled and the checkbox is checked.

### TC-AUTH-FUNC-005 — Unchecking "Remember Me" clears saved credentials
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** With credentials previously saved, uncheck "Remember Me", log in, log out, return to Login.
- **Expected Result:** Fields are empty; the checkbox is unchecked.

### TC-AUTH-FUNC-006 — Auto-login on app relaunch
- **Priority:** P1 · **Severity:** High · **Type:** Functional / Integration
- **Preconditions:** Logged in.
- **Steps:** Fully close and reopen the app.
- **Expected Result:** The auth-state listener restores the session and lands on Home without re-entering credentials.

### TC-AUTH-SEC-001 — "Remember Me" plaintext credential storage (security review)
- **Priority:** P2 · **Severity:** High · **Type:** Security / Negative
- **Steps:** With "Remember Me" enabled, inspect AsyncStorage key `@petcontrol_credentials` (via dev tools / device inspection).
- **Expected Result (defect check):** The password is stored in plaintext. **Record as a security finding** — this is the current behavior; confirm it is documented and accepted or fixed.

### TC-AUTH-FUNC-007 — Logout
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Steps:** Go to Settings → tap Logout.
- **Expected Result:** User is signed out; store cleared; redirected to Login. Relaunching does not auto-login (unless Remember Me refills the form only).

## 1.5 Password Visibility

### TC-AUTH-UI-001 — Toggle password visibility on Login
- **Priority:** P4 · **Severity:** Low · **Type:** UI
- **Steps:** On Login, type a password; tap the eye icon.
- **Expected Result:** Password toggles between masked and plaintext; icon switches eye/eye-off.

---

# 2. Family Module (FAM)

### TC-FAM-FUNC-001 — Invite code is displayed in Settings (owner)
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** As the owner, open Settings → Family section.
- **Expected Result:** The 6-character uppercase invite code is shown; a "Share code" button is present.

### TC-FAM-FUNC-002 — Share invite code
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Integration
- **Steps:** In Settings, tap "Share code".
- **Expected Result:** The Android share sheet opens with a message containing the invite code (Hebrew or English depending on language). Cancelling the share does not error.

### TC-FAM-INT-001 — Two members share one family's data (cross-member sync)
- **Priority:** P1 · **Severity:** Critical · **Type:** Integration / E2E / Data
- **Preconditions:** Owner (device 1) and Member (device 2) in the same family.
- **Steps:**
  1. On device 1, add a pet "Rex".
  2. On device 2, open the Pets tab (refocus).
  3. On device 2, add a medication to "Rex".
  4. On device 1, open Rex → Medications.
- **Expected Result:** Both members see "Rex" and the shared medication; changes propagate (real-time on sub-record screens; on focus for the pets list).

### TC-FAM-SEC-001 — Member of Family B cannot see Family A data
- **Priority:** P1 · **Severity:** Critical · **Type:** Security / Authorization / Negative
- **Preconditions:** Family A (with pets) and Family B (separate) exist.
- **Steps:** Log in as a Family B user; browse Pets, Dashboard, Reminders.
- **Expected Result:** Only Family B data is visible; no Family A pets/records appear. In Firestore rules, any direct read of Family A documents by the Family B user is denied.

### TC-FAM-EDGE-001 — Invite code query allowed pre-membership
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge / Authorization
- **Steps:** During join registration (authenticated, not yet a member), submit a valid code.
- **Expected Result:** The `families` list-by-inviteCode query succeeds (rules allow `list` for any authenticated user), the user is added, and subsequent `get` works as a member.

---

# 3. Pets Module (PET)

## 3.1 Create Pet

### TC-PET-FUNC-001 — Add a pet with all fields
- **Priority:** P1 · **Severity:** Critical · **Type:** Functional / Happy Path
- **Test Data:** name `Milo`, species `dog`, breed `Labrador`, sex `male`, birth year `2020`, color `Black`, neutered `Yes`, a gallery photo.
- **Steps:** Pets tab → FAB "+" → fill all fields, pick a photo → Save.
- **Expected Result:** Returns to Pets list; "Milo" appears in the Active filter with photo, species label, and age chip. Firestore `pets` doc has all fields, `isActive: true`, `birthdate` = Jan 1 2020, `photoUrl` set, `createdBy` = uid.

### TC-PET-FUNC-002 — Add a pet with only the required name
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Steps:** Add pet with only a name (defaults: species cat, sex unknown, not neutered, no photo) → Save.
- **Expected Result:** Pet is created and appears with the 🐾/species emoji fallback and no age chip; optional fields are omitted in Firestore (stripped when undefined).

### TC-PET-NEG-001 — Add a pet with empty name
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Open Add Pet, leave name empty → Save.
- **Expected Result:** `common.required` error shown; pet not created.

### TC-PET-NEG-002 — Add a pet with whitespace-only name
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Edge
- **Steps:** Enter `"   "` as the name → Save.
- **Expected Result:** Validation fails (name is trimmed to empty); pet not created.

### TC-PET-BOUND-001 — Birth year field length and value boundaries
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary
- **Steps:** In birth year, attempt to type 5 digits; then try `0000`; then a future year like `2999`.
- **Expected Result:** Input is capped at 4 digits (`maxLength=4`). `0000`/future years are accepted by the form (no range validation) and stored as `birthdate` = Jan 1 of that year; age chip may show 0/negative — **record any nonsensical age display as a Medium defect**.

### TC-PET-EDGE-001 — Non-numeric birth year is ignored
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Birth year uses a number pad; if any non-numeric entry is possible, enter it → Save.
- **Expected Result:** `birthYear`/`birthdate` are omitted (parse fails → undefined); pet saved without age.

### TC-PET-FUNC-003 — Species picker lists all species
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / UI
- **Steps:** Open Add Pet → open the species menu.
- **Expected Result:** All species (26+ including cat, dog, exotic types, and "other") are selectable with emoji + localized label; the scrollable menu shows every option.

## 3.2 List & Filter

### TC-PET-FUNC-004 — Active filter shows only active pets (default)
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Preconditions:** At least one active and one inactive/deceased pet.
- **Steps:** Open Pets tab (default "Active" segment).
- **Expected Result:** Only active pets are listed; inactive/deceased pets are hidden.

### TC-PET-FUNC-005 — Inactive filter shows only inactive/deceased pets
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Tap the "Inactive" segment.
- **Expected Result:** Only pets with `isActive === false` appear, dimmed (opacity), with an "Inactive" or "Deceased" chip; deceased ones show the deceased label.

### TC-PET-FUNC-006 — All filter shows every pet
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Tap "All".
- **Expected Result:** Active and inactive/deceased pets all appear.

### TC-PET-EDGE-002 — Pet with a missing name still appears and sorts last
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge / Data
- **Preconditions:** Create (via Firebase Console) a pet document with no `name` field.
- **Steps:** Open Pets tab.
- **Expected Result:** The nameless pet is still shown (not silently dropped) and sorts to the end of the list.

### TC-PET-FUNC-007 — Pets list refreshes on focus
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Integration
- **Steps:** On device 1 add a pet; on device 2 switch away from and back to the Pets tab.
- **Expected Result:** The new pet appears after refocus (one-shot getPets fallback).

## 3.3 Edit Pet

### TC-PET-FUNC-008 — Edit pet details
- **Priority:** P2 · **Severity:** High · **Type:** Functional
- **Steps:** Open a pet profile → pencil (edit) → change name, species, sex, breed, color, neutered, birth year → Save.
- **Expected Result:** The profile reflects all changes; Firestore `updatedAt` changes and fields update accordingly.

### TC-PET-FUNC-009 — Change pet photo
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional / Integration
- **Steps:** Edit pet → tap the photo → pick a new image → Save.
- **Expected Result:** New photo uploads to Storage; `photoUrl` updates; the profile and list show the new image.

### TC-PET-NEG-003 — Edit pet to empty name
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative
- **Steps:** In edit, clear the name → Save.
- **Expected Result:** `common.required` error; no update saved.

## 3.4 Pet Lifecycle (Delete / Deceased / Reactivate)

### TC-PET-FUNC-010 — Soft delete a pet
- **Priority:** P1 · **Severity:** High · **Type:** Functional / Data
- **Steps:** Open an active pet → trash icon → confirm "Delete".
- **Expected Result:** Navigates back; the pet no longer appears in Active but appears under Inactive/All. Firestore doc still exists with `isActive: false` (not removed); sub-records are retained.

### TC-PET-NEG-004 — Cancel delete
- **Priority:** P3 · **Severity:** Low · **Type:** Negative
- **Steps:** Trigger delete → tap Cancel in the confirmation.
- **Expected Result:** Pet remains active and unchanged.

### TC-PET-FUNC-011 — Mark a pet as deceased with a date
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Data
- **Steps:** Open an active pet → heart-broken icon → confirm the pre-filled today date (or pick one) → Save.
- **Expected Result:** Navigates back; pet leaves Active views and Dashboard; under Inactive/All it shows a "Deceased · <date>" chip. Firestore: `deceased: true`, `deathDate` set, `isActive: false`.

### TC-PET-NEG-005 — Mark deceased with an invalid date
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** In the deceased dialog, clear/enter an invalid date like `99/99/9999` → Save.
- **Expected Result:** `common.required` error shown; pet not marked deceased.

### TC-PET-FUNC-012 — Reactivate an inactive/deceased pet
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Data / Edge
- **Steps:** Open an inactive/deceased pet → restore icon → confirm.
- **Expected Result:** Pet returns to Active. Firestore: `isActive: true`, `deceased: false`, and the `deathDate` field is **deleted** (not just blanked).

### TC-PET-UI-001 — Header actions differ by pet state
- **Priority:** P3 · **Severity:** Low · **Type:** UI / Edge
- **Steps:** Compare header icons for an active vs. an inactive pet profile.
- **Expected Result:** Active pet shows edit + deceased + delete; inactive/deceased pet shows edit + restore (no delete/deceased).

### TC-PET-EDGE-003 — Open a non-existent / just-deleted pet id
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Navigate to `/pet/{id}` for an id not in the store (e.g., via a stale deep link).
- **Expected Result:** The screen shows a loading placeholder (`common.loading`) without crashing.

---

# 4. Dashboard Module (DASH) — Home tab

### TC-DASH-FUNC-001 — Greeting shows the user's display name
- **Priority:** P4 · **Severity:** Low · **Type:** Functional / UI
- **Steps:** Open Home.
- **Expected Result:** The title reads the dashboard greeting followed by the display name and 👋.

### TC-DASH-FUNC-002 — "Today" tasks list due items for today
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Preconditions:** A medication with `nextDueDate` = today (e.g., created with a daily reminder time later today).
- **Steps:** Open Home.
- **Expected Result:** The "Today's tasks" card lists the medication with the pet name, label, type emoji (💊), and a "today"/"today at HH:MM" description.

### TC-DASH-FUNC-003 — "Upcoming 7 days" section
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Boundary
- **Preconditions:** A vaccine/treatment/medication due in 1–7 days.
- **Steps:** Open Home.
- **Expected Result:** The item appears under "Upcoming"; items due in exactly 7 days are included; items >7 days are excluded.

### TC-DASH-FUNC-004 — "Overdue" section highlights past-due items
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Preconditions:** A vaccine with `nextDueDate` in the past.
- **Steps:** Open Home.
- **Expected Result:** An "Overdue" card (red left border) appears at the top listing the item with "overdue".

### TC-DASH-EDGE-001 — Old recurring medication advances to current cycle (not stuck overdue)
- **Priority:** P1 · **Severity:** High · **Type:** Edge / Functional
- **Preconditions:** A daily medication whose `nextDueDate` is weeks in the past.
- **Steps:** Open Home.
- **Expected Result:** The medication appears under Today/Upcoming (advanced forward by its frequency), not permanently in Overdue.

### TC-DASH-FUNC-005 — Mark a medication task as done from the dashboard
- **Priority:** P1 · **Severity:** High · **Type:** Functional / Data
- **Steps:** On a medication task, tap the green check-circle.
- **Expected Result:** The task's `nextDueDate` advances by exactly one frequency interval (preserving the reminder time); the dashboard refreshes and the task moves out of "today" accordingly. Non-medication tasks have no check button.

### TC-DASH-FUNC-006 — Tapping a task navigates to its record screen
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Integration
- **Steps:** Tap a task row (not the check button).
- **Expected Result:** Navigates to the correct pet sub-screen (e.g., `/pet/{id}/medications`).

### TC-DASH-FUNC-007 — Empty state when no tasks today
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Preconditions:** No tasks due today.
- **Steps:** Open Home.
- **Expected Result:** "No tasks today" message is shown in the Today card.

### TC-DASH-FUNC-008 — Pet quick-access grid
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / UI
- **Steps:** Scroll to the pet grid on Home.
- **Expected Result:** Only **active** pets are shown with photo or species emoji; count matches active pets; tapping a pet opens its profile.

### TC-DASH-EDGE-002 — Deceased pet's tasks excluded from dashboard
- **Priority:** P2 · **Severity:** High · **Type:** Edge / Data
- **Preconditions:** A pet with due medications is then marked deceased.
- **Steps:** Mark the pet deceased → open Home.
- **Expected Result:** That pet's tasks no longer appear (dashboard uses active pets only).

### TC-DASH-EDGE-003 — Dashboard does not live-update; refreshes on focus
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge
- **Steps:** With Home open, add a due medication from another screen/device without refocusing Home.
- **Expected Result:** Home may not update until refocused; on returning to Home the task appears (documents the one-shot-on-focus behavior).

---

# 5. Reminders Module (REM)

### TC-REM-FUNC-001 — Reminders grouped into Overdue / Today / Upcoming
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Ensure items exist in each bucket; open the Reminders tab.
- **Expected Result:** Three subheaders (Overdue in red, Today in primary, Upcoming in info color) list the correct tasks with `dd/MM/yyyy` dates and optional time; each non-empty section has a divider.

### TC-REM-FUNC-002 — Mark medication done from Reminders
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Tap the green check on a medication task.
- **Expected Result:** `nextDueDate` advances; the list refreshes.

### TC-REM-FUNC-003 — Empty state
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Preconditions:** No overdue/today/upcoming tasks.
- **Expected Result:** "No reminders" message is shown.

### TC-REM-FUNC-004 — Add-reminder dialog routes to a pet's medications
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Integration
- **Steps:** Tap the FAB → in the pet-selection dialog, tap "Add medication" for a pet.
- **Expected Result:** Dialog closes; navigates to that pet's medications screen.

### TC-REM-FUNC-005 — Add-reminder dialog routes to a pet's appointments
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** FAB → "Add appointment" for a pet.
- **Expected Result:** Navigates to that pet's appointments screen.

### TC-REM-EDGE-001 — Add-reminder dialog with no pets
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Preconditions:** No active pets.
- **Steps:** Open the FAB dialog.
- **Expected Result:** "No pets" message shown; no crash.

---

# 6. Medications Module (MED)

## 6.1 Create / Edit

### TC-MED-FUNC-001 — Add a regular daily medication with a reminder
- **Priority:** P1 · **Severity:** Critical · **Type:** Functional / Happy Path
- **Test Data:** name `Antibiotic`, dosage `1` unit `pill`, type `regular`, frequency daily ×1, reminder ON, time later today.
- **Steps:** Pet → Medications → FAB → fill fields, enable reminder, set the time, Save.
- **Expected Result:** The medication card appears with name, dosage+unit, "regular" chip, frequency, and next-due date. Firestore doc: `isActive:true`, `frequencyUnit:'daily'`, `reminderEnabled:true`, `reminderTime` set, `nextDueDate` set to today at the reminder time (since time is later today). A local notification is scheduled (verify on device).

### TC-MED-FUNC-002 — Multi-dose daily medication (frequency ×N)
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Edge
- **Test Data:** daily, frequency value `3`, reminder ON.
- **Steps:** Set frequency daily and value 3; observe reminder fields → three time pickers appear; set three times; Save.
- **Expected Result:** `reminderTimes` array with 3 entries saved; `reminderTime` = first entry; three daily local notifications scheduled (one per time).

### TC-MED-FUNC-003 — Weekly medication with a chosen weekday
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Frequency = weekly; choose a weekday from the menu; set a time; Save.
- **Expected Result:** `reminderDays` = [weekday index 0–6]; `nextDueDate` computed one week ahead at the chosen time.

### TC-MED-BOUND-001 — Monthly reminder day clamped to 1–31
- **Priority:** P2 · **Severity:** Medium · **Type:** Boundary
- **Steps:** Frequency = monthly; enter month day `0`, save; repeat with `45`.
- **Expected Result:** Saved `reminderDays[0]` is clamped to `1` for `0` and `31` for `45`.

### TC-MED-FUNC-004 — Temporary medication with a duration sets an end date
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Test Data:** type `temporary`, duration `2` `weeks`.
- **Steps:** Select temporary; enter duration 2 weeks; Save.
- **Expected Result:** `endDate` ≈ now + 2 weeks; `durationValue:2`, `durationUnit:'weeks'` saved.

### TC-MED-FUNC-005 — "As needed" medication has no due date or reminder
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Edge
- **Steps:** Frequency = as_needed; Save.
- **Expected Result:** No `nextDueDate`; the card omits the next-due line; no local notification is scheduled even if reminder was toggled.

### TC-MED-EDGE-001 — Daily reminder time earlier today schedules for next cycle
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge
- **Steps:** Add a daily medication with a reminder time that has already passed today; Save.
- **Expected Result:** `nextDueDate` is set to a future day (now + frequency) at that time, not today.

### TC-MED-EDGE-002 — Daily reminder time later today appears in "Today"
- **Priority:** P2 · **Severity:** Medium · **Type:** Edge / Integration
- **Steps:** Add a daily medication with a reminder time later today; open Home.
- **Expected Result:** The task appears under Today at that time.

### TC-MED-FUNC-006 — Edit a medication
- **Priority:** P2 · **Severity:** High · **Type:** Functional
- **Steps:** Tap the pencil on a medication → change name/dosage/frequency/reminder → Save.
- **Expected Result:** Card updates; Firestore updated; the local notification is rescheduled for the edited medication (only that med's notifications change).

### TC-MED-NEG-001 — Add medication with missing name or dosage
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Leave name empty (or dosage empty) → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-MED-BOUND-002 — Frequency value non-numeric / empty defaults to 1
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary / Edge
- **Steps:** Clear the frequency value (or enter invalid) → Save.
- **Expected Result:** Saved `frequencyValue` defaults to 1 (`parseInt || 1`).

## 6.2 Delete & Notifications

### TC-MED-FUNC-007 — Delete a medication cancels its notification
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Integration
- **Steps:** Delete a medication → confirm.
- **Expected Result:** Removed from the list and Firestore; its scheduled local notifications are cancelled (verify no further reminders fire); the AsyncStorage map no longer contains its id.

### TC-MED-NEG-002 — Cancel medication delete
- **Priority:** P3 · **Severity:** Low · **Type:** Negative
- **Steps:** Trigger delete → Cancel.
- **Expected Result:** Medication remains; notification unchanged.

### TC-MED-INT-001 — Notifications rescheduled at app boot
- **Priority:** P2 · **Severity:** Medium · **Type:** Integration / Recovery
- **Preconditions:** ≥1 active medication with reminder on a physical device.
- **Steps:** Force-close and reopen the app.
- **Expected Result:** All active medications' reminders are re-scheduled from scratch (the boot bootstrapper cancels all and re-adds), with no duplicate notifications.

### TC-MED-FUNC-008 — Only active medications are listed
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Data
- **Preconditions:** A medication set to `isActive:false` (via console).
- **Steps:** Open the medications screen.
- **Expected Result:** Only `isActive:true` medications appear (subscription filters on `isActive == true`).

---

# 7. Vaccines Module (VAC)

### TC-VAC-FUNC-001 — Add a common vaccine with auto next-due
- **Priority:** P1 · **Severity:** High · **Type:** Functional / Happy Path
- **Test Data:** vaccine `Rabies` (interval 365), date today, auto next-due ON.
- **Steps:** Pet → Vaccines → FAB → select Rabies, confirm date, keep auto next-due, Save.
- **Expected Result:** Card shows the vaccine, date, and a next-due chip ≈ today + 365 days with green/warning/danger color by proximity. Firestore: `reminderEnabled:true`, `reminderDaysBeforeDue:30`, `nextDueDate` = date + 365d.

### TC-VAC-FUNC-002 — Add "Other" vaccine with manual next-due
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Edge
- **Steps:** Select "Other"; enter a custom name; optionally enter a manual next-due date; Save.
- **Expected Result:** The custom name is used; `nextDueDate` = the manual date if provided, else omitted.

### TC-VAC-FUNC-003 — Toggle off auto next-due to enter a manual date
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** For a known vaccine, turn off "auto next due"; a manual date field appears; enter a date; Save.
- **Expected Result:** `nextDueDate` uses the manual date, not the auto interval.

### TC-VAC-NEG-001 — Missing custom name for "Other"
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Select "Other", leave the custom name empty → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-VAC-NEG-002 — Invalid vaccination date
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Enter an invalid date (e.g., `32/13/2026`) → Save.
- **Expected Result:** Invalid-date error (`appointments.invalidDate`); not saved.

### TC-VAC-NEG-003 — Invalid manual next-due date
- **Priority:** P3 · **Severity:** Low · **Type:** Negative
- **Steps:** With manual next-due, enter an unparseable date → Save.
- **Expected Result:** `vaccines.manualNextDue` error; not saved.

### TC-VAC-FUNC-004 — Edit a vaccine
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Tap pencil → change date/vet/notes → Save.
- **Expected Result:** Updated in the list and Firestore. (Note: in edit mode the vaccine-type selector is hidden; only editable fields change.)

### TC-VAC-FUNC-005 — Delete a vaccine
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Tap trash → confirm.
- **Expected Result:** Vaccine removed from list and Firestore.

### TC-VAC-BOUND-001 — Next-due status color thresholds
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary / UI
- **Steps:** Create vaccines with next-due: overdue (past), within 30 days, and >30 days.
- **Expected Result:** Colors are danger (past/overdue), warning (≤30 days), success (>30 days); overdue chip shows "overdue".

### TC-VAC-INT-001 — Vaccine due within window appears on dashboard/reminders
- **Priority:** P2 · **Severity:** Medium · **Type:** Integration
- **Steps:** Add a vaccine with next-due within 7 days → open Home/Reminders.
- **Expected Result:** The vaccine appears in Upcoming (or Overdue if past). *Note:* this relies on the composite index for the `nextDueDate` range+orderBy query; if it errors, the item is silently skipped — verify the index exists.

---

# 8. Treatments Module (TRT)

### TC-TRT-FUNC-001 — Add a flea/tick treatment with next treatment
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Happy Path
- **Test Data:** category `flea_tick`, product `Frontline`, date today, next treatment ON (default +30 days), reminder ON, days-before `7`.
- **Steps:** Pet → Treatments → FAB → fill fields → Save.
- **Expected Result:** Card shows product, date, next-due, and category chip. Firestore: `nextDueDate` set, `reminderEnabled:true`, `reminderDaysBeforeDue:7`.

### TC-TRT-FUNC-002 — Category change updates the suggested next-due date
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Edge
- **Steps:** Change category from flea_tick to deworming.
- **Expected Result:** The next-due suggestion changes (deworming → +90 days; others → +30 days).

### TC-TRT-FUNC-003 — Treatment without a next treatment
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Toggle off "has next treatment" → Save.
- **Expected Result:** No `nextDueDate`; `reminderEnabled:false`; card shows only the treatment date.

### TC-TRT-NEG-001 — Missing product name
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Leave product empty → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-TRT-NEG-002 — Invalid treatment or next-due date
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative
- **Steps:** Enter an invalid treatment date (or invalid next-due while next treatment is on) → Save.
- **Expected Result:** `appointments.invalidDate` error; not saved.

### TC-TRT-EDGE-001 — No edit/delete UI for treatments
- **Priority:** P3 · **Severity:** Low · **Type:** Edge / Gap
- **Steps:** Inspect a treatment card for edit/delete controls.
- **Expected Result:** Treatments can only be **added** (no edit/delete in the UI). **Record as a coverage/feature gap** — a mistaken treatment cannot be corrected in-app.

### TC-TRT-INT-001 — Treatment due within window appears on reminders
- **Priority:** P3 · **Severity:** Low · **Type:** Integration
- **Steps:** Add a treatment with next-due within 7 days → Reminders.
- **Expected Result:** Appears in Upcoming/Overdue (subject to the composite index for the range+orderBy query).

---

# 9. Appointments Module (APT)

### TC-APT-FUNC-001 — Schedule an appointment
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Happy Path
- **Test Data:** title `Annual checkup`, vet `Dr. Cohen`, clinic `City Vet`, date +7 days, time `10:00`.
- **Steps:** Pet → Appointments → FAB → fill fields → Save.
- **Expected Result:** Card shows title, date+time, vet, and a "scheduled" status chip; action buttons for complete/cancel appear. Firestore: `status:'scheduled'`, `reminderEnabled:true`, `reminderMinutesBefore:1440`.

### TC-APT-FUNC-002 — Edit a scheduled appointment
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional
- **Steps:** Tap pencil on a scheduled appointment → change fields → Save.
- **Expected Result:** Updated in list and Firestore.

### TC-APT-FUNC-003 — Mark appointment completed
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / State
- **Steps:** Tap "Mark completed".
- **Expected Result:** Status → completed (green chip); complete/cancel actions and the edit pencil disappear; it leaves the dashboard/reminders (only scheduled appear there).

### TC-APT-FUNC-004 — Cancel an appointment
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / State
- **Steps:** Tap "Cancel".
- **Expected Result:** Status → cancelled (red chip); removed from upcoming reminders.

### TC-APT-NEG-001 — Missing title
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Leave title empty → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-APT-NEG-002 — Invalid date/time
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Enter an invalid date or a non-numeric time → Save.
- **Expected Result:** `appointments.invalidDate` error; not saved.

### TC-APT-FUNC-005 — Appointment ordering (soonest first)
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Add several appointments with different dates.
- **Expected Result:** Listed ascending by scheduled date.

### TC-APT-INT-001 — Scheduled appointment within 7 days appears on dashboard
- **Priority:** P2 · **Severity:** Medium · **Type:** Integration
- **Steps:** Schedule an appointment for tomorrow → open Home.
- **Expected Result:** Appears under Today/Upcoming with its time; completed/cancelled ones do not appear.

---

# 10. Weight Module (WGT)

### TC-WGT-FUNC-001 — Add a weight record
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Happy Path
- **Test Data:** `4.5` kg, note `after meal`.
- **Steps:** Pet → Weight → FAB → enter weight and note → Save.
- **Expected Result:** Record appears with weight, date, and note. Firestore weight doc created with `weightKg:4.5`.

### TC-WGT-EDGE-001 — Decimal comma is accepted
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Enter `4,5` → Save.
- **Expected Result:** Parsed as 4.5 (comma converted to period).

### TC-WGT-NEG-001 — Zero or negative weight rejected
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Boundary
- **Steps:** Enter `0` (then `-2`) → Save.
- **Expected Result:** `common.required` error (weight must be > 0); not saved.

### TC-WGT-NEG-002 — Non-numeric weight rejected
- **Priority:** P3 · **Severity:** Low · **Type:** Negative
- **Steps:** Enter non-numeric text (if the keypad allows) → Save.
- **Expected Result:** Validation fails (NaN); not saved.

### TC-WGT-FUNC-002 — Edit a weight record
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Tap pencil → change value/note → Save.
- **Expected Result:** Record updates.

### TC-WGT-FUNC-003 — Delete a weight record
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Tap trash → confirm.
- **Expected Result:** Record removed from list and Firestore.

### TC-WGT-BOUND-001 — Chart requires at least 2 records
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary / UI
- **Steps:** With 1 record, view the screen; add a 2nd record.
- **Expected Result:** With 1 record no chart is shown; with ≥2 records the line chart appears (using up to the last 10 records, chronological).

### TC-WGT-FUNC-004 — Trend indicator
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Add records so the newest is heavier / lighter / ~equal to the previous.
- **Expected Result:** Trend shows ▲ up (>0.05 kg increase), ▼ down (>0.05 kg decrease), or — stable.

---

# 11. Food Module (FOOD)

### TC-FOOD-FUNC-001 — Add a food record
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Happy Path
- **Test Data:** type `dry`, name `Royal Canin`, brand `RC`, amount `100`, unit `gram`.
- **Steps:** Pet → Food → FAB → fill fields → Save.
- **Expected Result:** Record appears with name·brand, amount+unit, date/time, and type chip. Firestore food doc created.

### TC-FOOD-NEG-001 — Missing name or amount
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Leave name empty (or amount empty) → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-FOOD-NEG-002 — Zero/negative/non-numeric amount
- **Priority:** P3 · **Severity:** Low · **Type:** Negative / Boundary
- **Steps:** Enter amount `0` (then `-5`) → Save.
- **Expected Result:** Validation fails (amount must be > 0); not saved.

### TC-FOOD-FUNC-002 — Edit a food record
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Tap pencil → change fields → Save.
- **Expected Result:** Record updates.

### TC-FOOD-FUNC-003 — Today's total (gram records only)
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Edge
- **Steps:** Add two gram records today and one "cups"/"pouch" record today.
- **Expected Result:** "Today total" sums only the **gram** records (non-gram units excluded); shown in grams.

### TC-FOOD-FUNC-004 — Weekly bar chart
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / UI
- **Steps:** Add gram records across different days of the last 7 days.
- **Expected Result:** The 7-day bar chart appears only when there is gram data, with per-day totals and localized day labels.

### TC-FOOD-EDGE-001 — No delete for food records
- **Priority:** P3 · **Severity:** Low · **Type:** Edge / Gap
- **Steps:** Inspect a food card for a delete control.
- **Expected Result:** Only add/edit are available; **no delete UI** — record as a coverage gap (erroneous food entries can't be removed in-app).

---

# 12. Medical File / Documents Module (DOC)

### TC-DOC-FUNC-001 — Upload an image document
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Integration
- **Test Data:** name `X-ray 2026`, an image from the gallery.
- **Steps:** Pet → Medical File → FAB → enter name → "Pick image" → select an image → Save.
- **Expected Result:** Upload progress indicator shows, then the document appears with an image icon and "IMAGE" chip. Firestore doc has `fileType:'image'`, a Storage `fileUrl`, and `mimeType`.

### TC-DOC-FUNC-002 — Upload a PDF document
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / Integration
- **Preconditions:** `expo-document-picker` installed.
- **Steps:** FAB → name → "Pick PDF" → choose a PDF → Save.
- **Expected Result:** Document appears with a PDF icon and "PDF" chip; `fileType:'pdf'`.

### TC-DOC-EDGE-001 — Document picker library missing
- **Priority:** P3 · **Severity:** Low · **Type:** Edge / Error Handling
- **Preconditions:** `expo-document-picker` not installed.
- **Steps:** Tap "Pick PDF".
- **Expected Result:** An informative alert (`docPickerMissing`/`docPickerInstall`) is shown; no crash.

### TC-DOC-NEG-001 — Save without a name
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Leave the document name empty, pick a file → Save.
- **Expected Result:** `common.required` error; not saved.

### TC-DOC-NEG-002 — Save without selecting a file
- **Priority:** P2 · **Severity:** Medium · **Type:** Negative / Validation
- **Steps:** Enter a name but pick no file → Save.
- **Expected Result:** `medicalFile.noFileSelected` error; Save button is disabled until a file is chosen.

### TC-DOC-FUNC-003 — Open a document
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Integration
- **Steps:** Tap a document card.
- **Expected Result:** The file URL opens in the browser/appropriate viewer (Linking.openURL); failure to open does not crash.

### TC-DOC-FUNC-004 — Delete a document
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional / Data
- **Steps:** Tap the trash on a document → confirm.
- **Expected Result:** Firestore document record is removed from the list. *Note:* the underlying Storage object may remain (no storage deletion in code) — verify and record as a Low data-hygiene finding.

### TC-DOC-ERR-001 — Upload failure handling
- **Priority:** P3 · **Severity:** Medium · **Type:** Error Handling
- **Steps:** Trigger an upload while offline or with Storage rules blocking → Save.
- **Expected Result:** An error message is shown in the dialog; the dialog remains open; no partial/orphaned Firestore record without a file URL.

---

# 13. AI Assistant Module (AI)

### TC-AI-FUNC-001 — Ask a question (all pets context)
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional / Integration
- **Preconditions:** `askPetAI` deployed; ANTHROPIC_API_KEY set; online.
- **Steps:** AI tab → type a question → Send.
- **Expected Result:** A "thinking" indicator appears, then an assistant bubble with a relevant response in the current language.

### TC-AI-FUNC-002 — Suggested question chips
- **Priority:** P4 · **Severity:** Low · **Type:** Functional
- **Steps:** On the empty AI screen, tap a suggested question chip.
- **Expected Result:** The question is sent and answered; suggestions match the current language.

### TC-AI-FUNC-003 — Pet context selection
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Integration
- **Steps:** Open the pet chip menu → select a specific pet → ask a question.
- **Expected Result:** The response reflects the pet's species/breed context (context is passed to the function). Only active pets are listed in the selector.

### TC-AI-FUNC-004 — Clear chat
- **Priority:** P4 · **Severity:** Low · **Type:** Functional
- **Steps:** With messages present, tap the clear (delete-sweep) icon.
- **Expected Result:** All messages are cleared; the welcome/suggestions view returns.

### TC-AI-NEG-001 — Send empty/whitespace message
- **Priority:** P3 · **Severity:** Low · **Type:** Negative
- **Steps:** With an empty or whitespace-only input, tap Send.
- **Expected Result:** Nothing is sent; the send icon is disabled while input is empty.

### TC-AI-BOUND-001 — Input length cap (1000 chars)
- **Priority:** P3 · **Severity:** Low · **Type:** Boundary
- **Steps:** Paste/type more than 1000 characters.
- **Expected Result:** Input is capped at 1000 characters (`maxLength`).

### TC-AI-ERR-001 — Cloud Function error / not deployed
- **Priority:** P2 · **Severity:** Medium · **Type:** Error Handling
- **Preconditions:** Function undeployed or secret missing, or device offline.
- **Steps:** Send a question.
- **Expected Result:** An assistant error bubble appears (localized "Error: …"); the app does not crash; the user can retry.

### TC-AI-SEC-001 — API key not exposed to client
- **Priority:** P2 · **Severity:** High · **Type:** Security
- **Steps:** Inspect app bundle/config and network traffic (DevTools) during an AI request.
- **Expected Result:** No ANTHROPIC API key is present client-side; only the callable function request/response is visible.

### TC-AI-SEC-002 — Unauthenticated call rejected
- **Priority:** P3 · **Severity:** Medium · **Type:** Security / Authorization
- **Steps:** (Grey-box) invoke `askPetAI` without auth via the Firebase callable tester.
- **Expected Result:** The function throws `unauthenticated`.

---

# 14. Settings Module (SET)

### TC-SET-FUNC-001 — Toggle notification preference (per type)
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional / Data
- **Steps:** Settings → toggle off "Medications" notifications.
- **Expected Result:** The switch updates immediately; the member doc's `notificationPrefs.medications` becomes `false` in Firestore; the cloud reminder function will skip medication pushes for this family.

### TC-SET-FUNC-002 — Language toggle prompts restart and switches to English
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / i18n
- **Steps:** Settings → toggle the Hebrew switch off → in the restart dialog, tap "Restart".
- **Expected Result:** The app reloads; the UI is English and LTR.

### TC-SET-FUNC-003 — Cancel language change reverts the toggle
- **Priority:** P3 · **Severity:** Low · **Type:** Functional / Edge
- **Steps:** Toggle language → tap Cancel in the restart dialog.
- **Expected Result:** The visual toggle reverts to its prior state (no restart). *Note:* the language preference may already be persisted; verify whether a later manual restart applies it — record any inconsistency.

### TC-SET-FUNC-004 — Invite code shown / share button (owner)
- **Priority:** P3 · **Severity:** Low · **Type:** Functional
- **Steps:** Open Settings.
- **Expected Result:** Invite code and Share button are present when the family is loaded; a placeholder (`------`) shows if no code is available.

### TC-SET-FUNC-005 — Logout from settings
- **Priority:** P1 · **Severity:** High · **Type:** Functional
- **Steps:** Tap Logout.
- **Expected Result:** Signed out and redirected to Login.

---

# 15. Notifications Module (NOTIF)

> Local notification cases require a **physical Android device** with notification permission granted and Google Play Services (for FCM). Emulator cannot fully validate these.

### TC-NOTIF-FUNC-001 — Permission request and FCM token registration
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Integration
- **Steps:** First launch after login on a device → accept the notification permission prompt.
- **Expected Result:** A raw FCM device token is obtained and saved to the member doc's `fcmTokens[]` (arrayUnion, no duplicates). Verify the token appears in Firestore.

### TC-NOTIF-NEG-001 — Permission denied
- **Priority:** P3 · **Severity:** Medium · **Type:** Negative
- **Steps:** Deny the notification permission.
- **Expected Result:** No token is saved; the app continues to function; no crash.

### TC-NOTIF-EDGE-001 — Emulator / no device returns null token
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Run on an emulator without a real device token.
- **Expected Result:** `registerForPushNotifications` returns null; no token write; app continues.

### TC-NOTIF-FUNC-002 — Local medication reminder fires at the set time
- **Priority:** P2 · **Severity:** High · **Type:** Functional / Integration
- **Steps:** Add a daily medication with a reminder time ~2 minutes ahead; wait.
- **Expected Result:** A local notification "💊 <pet> / <med> – <dosage>" fires at the time; tapping it deep-links to that pet's medications screen.

### TC-NOTIF-FUNC-003 — Multi-dose medication fires per time slot
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional
- **Steps:** Create a multi-dose daily medication with two near-future times.
- **Expected Result:** A separate notification fires for each configured time.

### TC-NOTIF-INT-001 — Cloud daily reminder delivers to all family devices
- **Priority:** P2 · **Severity:** High · **Type:** Integration
- **Preconditions:** Family with FCM tokens on ≥1 device; a medication due today (not in quiet hours).
- **Steps:** Trigger `sendDailyReminders` (Firebase Console) or wait for 06:00 UTC.
- **Expected Result:** A push notification is delivered to family devices for the due medication/vaccine/treatment/appointment per rules.

### TC-NOTIF-FUNC-004 — Notification preference suppresses a type (cloud)
- **Priority:** P3 · **Severity:** Medium · **Type:** Functional
- **Preconditions:** `notificationPrefs.medications = false`.
- **Steps:** Trigger the daily function with a medication due today.
- **Expected Result:** No medication push is sent to that family (other enabled types still send).

### TC-NOTIF-BOUND-001 — Quiet hours suppress cloud pushes
- **Priority:** P3 · **Severity:** Medium · **Type:** Boundary
- **Preconditions:** Current server run time falls within the family's quiet window (e.g., 22:00–08:00 wrapping midnight).
- **Steps:** Trigger the function during quiet hours.
- **Expected Result:** No push is sent to that family (quiet-hour check, including the midnight-wrapping period).

### TC-NOTIF-INT-002 — Vaccine/treatment days-before window (cloud)
- **Priority:** P3 · **Severity:** Medium · **Type:** Integration / Boundary
- **Steps:** Add a vaccine due in exactly `reminderDaysBeforeDue` days; trigger the function.
- **Expected Result:** A push is sent when `0 ≤ daysLeft ≤ reminderDaysBeforeDue`; none when past or beyond the window.

---

# 16. i18n / RTL Module (I18N)

### TC-I18N-FUNC-001 — Default language is Hebrew (RTL)
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional / UI
- **Steps:** Fresh install → launch.
- **Expected Result:** UI is in Hebrew with RTL layout; dates use the Hebrew locale.

### TC-I18N-FUNC-002 — Switch to English (LTR) after restart
- **Priority:** P2 · **Severity:** Medium · **Type:** Functional
- **Steps:** Settings → turn off Hebrew → Restart.
- **Expected Result:** All screens render English strings and LTR layout; no leftover hardcoded Hebrew in standard screens (note: some numeric-unit suffixes like the weight axis suffix and hardcoded age words `שנים/חודשים` may remain — record as Low i18n defects).

### TC-I18N-EDGE-001 — Localized date formatting
- **Priority:** P3 · **Severity:** Low · **Type:** Edge
- **Steps:** Compare a record's date rendering in Hebrew vs. English.
- **Expected Result:** Dates format via the correct `date-fns` locale in each language.

---

# 17. Security / Data Isolation Module (SEC)

### TC-SEC-FUNC-001 — Family-scoped read access (rules)
- **Priority:** P1 · **Severity:** Critical · **Type:** Security / Authorization
- **Steps:** (Grey-box, Firestore rules simulator or second account) attempt to read `families/{otherFamilyId}/pets/...` as a non-member.
- **Expected Result:** Read denied.

### TC-SEC-FUNC-002 — Family-scoped write access (rules)
- **Priority:** P1 · **Severity:** Critical · **Type:** Security / Authorization / Negative
- **Steps:** Attempt to write a pet/record into another family as a non-member.
- **Expected Result:** Write denied.

### TC-SEC-FUNC-003 — Member document self-only write
- **Priority:** P2 · **Severity:** High · **Type:** Security
- **Steps:** Attempt to update another user's member document.
- **Expected Result:** Denied (only the owning uid, and only while a family member, may update/delete their own member doc).

### TC-SEC-FUNC-004 — Family cannot be deleted
- **Priority:** P2 · **Severity:** Medium · **Type:** Security / Data
- **Steps:** Attempt to delete a family document (rules simulator).
- **Expected Result:** Delete denied (`allow delete: if false`).

### TC-SEC-EDGE-001 — Non-member self-join update constraints
- **Priority:** P2 · **Severity:** High · **Type:** Security / Edge
- **Steps:** As a non-member, attempt a family update that (a) only adds your uid to `memberUids` (valid), and (b) also changes `inviteCode` or `ownerUid` (invalid).
- **Expected Result:** (a) is allowed; (b) is denied — the self-join rule forbids altering `inviteCode`/`ownerUid`.

### TC-SEC-FUNC-005 — Users index is self-only
- **Priority:** P2 · **Severity:** High · **Type:** Security
- **Steps:** Attempt to read/write another user's `users/{uid}` index doc.
- **Expected Result:** Denied (only `request.auth.uid == userId`).

---

# 18. End-to-End Journeys (E2E)

### TC-E2E-001 — New owner: register → add pet → add medication → dashboard → mark done
- **Priority:** P1 · **Severity:** Critical · **Type:** E2E / Happy Path
- **Steps:**
  1. Register as a new owner (create family).
  2. Add a pet.
  3. Add a daily medication with a reminder time later today.
  4. Open Home; confirm the task appears under Today.
  5. Tap the green check to mark it done.
- **Expected Result:** Each step succeeds; after mark-done the task's next due advances and the dashboard updates. Firestore reflects all writes.

### TC-E2E-002 — Member joins and shares data
- **Priority:** P1 · **Severity:** Critical · **Type:** E2E / Integration
- **Steps:** Owner shares code (Settings) → new user registers with the code → member views the owner's pets and adds a health record → owner sees it.
- **Expected Result:** Data is shared both directions within the family.

### TC-E2E-003 — Vaccine lifecycle to reminder
- **Priority:** P2 · **Severity:** High · **Type:** E2E
- **Steps:** Add a vaccine with a next-due within the reminder window → confirm it appears on Reminders/Home → (grey-box) trigger the cloud function within the days-before window.
- **Expected Result:** The vaccine surfaces in the UI and a cloud push is delivered within the window.

### TC-E2E-004 — Pet passing and reactivation
- **Priority:** P2 · **Severity:** High · **Type:** E2E / Data
- **Steps:** Mark a pet deceased → confirm it leaves Active/Home and shows under Inactive with a deceased date → reactivate → confirm it returns to Active and death metadata is cleared.
- **Expected Result:** Lifecycle transitions behave as specified; Firestore fields update/delete accordingly.

### TC-E2E-005 — Appointment lifecycle
- **Priority:** P2 · **Severity:** Medium · **Type:** E2E / State
- **Steps:** Schedule an appointment for tomorrow → confirm on Home → mark completed → confirm it leaves reminders.
- **Expected Result:** Status transitions and dashboard filtering behave correctly.

### TC-E2E-006 — Language switch end to end
- **Priority:** P3 · **Severity:** Medium · **Type:** E2E / i18n
- **Steps:** Switch to English and restart → navigate all tabs and a pet's sub-screens.
- **Expected Result:** All screens render in English/LTR with correctly localized dates.

---

# 19. Smoke Test Suite (SMOKE)

### TC-SMOKE-001 — Build acceptance smoke
- **Priority:** P1 · **Severity:** Critical · **Type:** Smoke
- **Steps:**
  1. Launch the app → Login screen appears.
  2. Log in with valid credentials → Home loads.
  3. Open each tab: Home, Pets, Reminders, AI, Settings.
  4. Add a pet → it appears in the list.
  5. Open the pet and open each sub-screen (Weight, Medications, Vaccines, Treatments, Appointments, Food, Medical File) without crashing.
  6. Log out → Login screen returns.
- **Expected Result:** All steps complete without crashes or blank screens; core navigation and one create flow work.

---

# 20. Data Integrity & Offline (DATA)

### TC-DATA-FUNC-001 — Persistence across restart
- **Priority:** P2 · **Severity:** High · **Type:** Data
- **Steps:** Create records of each type → force-close → reopen.
- **Expected Result:** All records persist and reload correctly.

### TC-DATA-EDGE-001 — Offline create then sync
- **Priority:** P2 · **Severity:** High · **Type:** Edge / Recovery / Integration
- **Steps:** Enable airplane mode → add a pet and a weight record → re-enable network.
- **Expected Result:** Writes are queued locally, the UI reflects them, and they sync to Firestore on reconnect with no loss or duplication.

### TC-DATA-EDGE-002 — Concurrent edit by two members
- **Priority:** P3 · **Severity:** Medium · **Type:** Edge
- **Steps:** Both members edit the same medication near-simultaneously.
- **Expected Result:** Last write wins without corruption; both clients converge to the same final state after sync (no crash, no partial doc).

### TC-DATA-FUNC-002 — Undefined fields are not persisted
- **Priority:** P3 · **Severity:** Low · **Type:** Data
- **Steps:** Create a record leaving optional fields blank → inspect Firestore.
- **Expected Result:** Optional/undefined fields are absent from the document (stripped), not stored as null/undefined.

---

# Final Gap Analysis

### Tested / Covered
- Authentication (register create/join, login, logout, remember me, session).
- Family invite/join/isolation and Firestore security rules.
- Pets CRUD, filter, and full lifecycle (delete/deceased/reactivate).
- Dashboard and Reminders grouping, mark-done, navigation.
- Medications (all frequencies/types, smart reminders, due-date logic, local notifications).
- Vaccines, Appointments (with edit), Weight (with edit/delete), Medical Documents.
- AI assistant (function, context, errors, security).
- Settings (language, prefs, share, logout), i18n/RTL.
- Data integrity, offline queue, cross-member sync.

### Partially Covered
- **Notifications (device-dependent):** Local notification firing and FCM delivery cannot be validated on an emulator; require a physical device and a triggered/observed cloud run.
- **Cloud function internals:** `sendDailyReminders` and `askPetAI` are verified through the app and manual console triggering, not through code-level automation.
- **Food & Treatments:** Only add/edit (food) / add-only (treatments) are exposed; delete/edit gaps limit corrective flows.

### Not Covered / Gaps (Needs Product Decision)
- **No edit or delete UI for Treatments** — a mistaken treatment cannot be corrected in-app. *(Feature gap.)*
- **No delete UI for Food records.** *(Feature gap.)*
- **Storage object not deleted** when a medical document Firestore record is deleted (potential orphaned file). *(Data hygiene.)*
- **"Remember Me" stores the password in plaintext** in AsyncStorage. *(Security — needs review.)*
- **Silent error-swallowing** (`catch(() => {})`, `catch { skip }`) in dashboard queries and save flows can hide missing composite indexes or failed writes; verify via Firestore during testing.
- **Birth year has no range validation** (accepts `0000`/far-future), which can yield nonsensical age chips.

### Needs Clarification
- **Language "Cancel"** in the restart dialog: whether the persisted language preference is reverted, or only the visual toggle — confirm intended behavior.
- **Expected minimum password policy** beyond Firebase's default (6 chars) — confirm product requirement.
- **Composite indexes** required for dashboard vaccine/treatment/appointment queries — confirm they are deployed (`firestore.indexes.json`), otherwise those items silently never appear.

### Recommended Next Steps
1. Confirm and deploy all required Firestore composite indexes; re-run dashboard/reminders integration cases.
2. Add product decisions for the Treatments/Food edit-delete gaps and the document Storage cleanup.
3. Review "Remember Me" credential storage security.
4. Execute the device-dependent notification suite on ≥1 physical Android device.
5. Consider future automation for regression of due-date logic (`medicationUtils`, dashboard advancement) — high-value, deterministic, and already partially unit-tested.

---

**End of STR.md**
