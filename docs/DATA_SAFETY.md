# Google Play — Data Safety answer sheet (PetControl)

A field-by-field guide for the **Data safety** section in Play Console.
Based on what the app actually does (verified against the source code).
Privacy policy URL: `https://petcontrol-ac39f.web.app/privacy-policy.html`

---

## Section 1 — Data collection & sharing (overview)

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (Firebase uses HTTPS/TLS) |
| Do you provide a way for users to request that their data be deleted? | **Yes** (in-app: Settings → Delete account; and by email) |

> **"Collected" vs "Shared":** Data sent to **Firebase (Google)** counts as *collected/processed by a service provider*, **not** "shared" with a third party. This app does **not** share data with any third party. Answer **"Collected: Yes / Shared: No"** for every type below.

---

## Section 2 — Data types

For each type: **Collected = Yes**, **Shared = No**, **Processing = not ephemeral** (it's stored), and mark **Required** unless noted.

### Personal info
| Data type | Collected | Purpose(s) | Required? |
|---|---|---|---|
| **Name** (display name, family name) | Yes | App functionality | Required |
| **Email address** | Yes | App functionality; Account management | Required |

> Password is used for authentication via Firebase Auth. In the Play form, a password is **not** a listed data type — it's covered under account authentication and does not need its own entry. (Note: the app does **not** store the password itself; Firebase Auth handles it.)

### Photos and videos
| Data type | Collected | Purpose(s) | Required? |
|---|---|---|---|
| **Photos** (pet photos) | Yes | App functionality | Optional |

### Files and docs
| Data type | Collected | Purpose(s) | Required? |
|---|---|---|---|
| **Files and docs** (uploaded medical documents – images/PDF) | Yes | App functionality | Optional |

### App info and performance
None. (No crash logs, diagnostics, or analytics SDKs are integrated.)

### Device or other IDs
| Data type | Collected | Purpose(s) | Required? |
|---|---|---|---|
| **Device or other IDs** (FCM push token) | Yes | App functionality (sending reminders) | Required |

---

## Section 3 — Data types NOT collected (leave unchecked)

- **Location** (approximate or precise) — not collected.
- **Financial info** — not collected.
- **Health and fitness** — not collected. *(The app stores **pets'** health records, which is not the user's personal health data — this Play category refers to the user's own health.)*
- **Messages, Contacts, Calendar, Web browsing** — not collected.
- **Audio** — not collected.
- **Analytics / Ads / Marketing** — no advertising or analytics; nothing collected for these purposes.

---

## Section 4 — Notes for the reviewer / consistency checks

- The **only** processor is Google Firebase (Auth, Firestore, Storage, Cloud Messaging). No other SDKs.
- Deletion is genuine: the `deleteAccount` Cloud Function permanently removes the family's Firestore data and Storage files when the last member deletes their account.
- Make sure the answers here stay consistent with the **privacy policy** text — both must say the same thing (no location, no ads, no analytics, no third-party sharing, deletion available).
- Pet-related data (species, breed, weight, medications, vaccines, etc.) is **user-generated content** stored for app functionality; it does not map to a sensitive Play data category.
