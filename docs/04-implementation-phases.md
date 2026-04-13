# PetControl – תוכנית יישום (ספרינטים)

**גרסה:** 1.0  
**תאריך:** 2026-04-13

---

## ספרינט 1 – יסודות (משוער: 8-10 שעות)

**מטרה:** אפליקציה עובדת עם אימות, ניהול Family וניהול חיות

| # | משימה | תלויות | סטטוס |
|---|---|---|---|
| 1.1 | Init Expo + TypeScript | — | ✅ |
| 1.2 | יצירת מסמכי תיעוד | — | ✅ |
| 1.3 | התקנת dependencies | 1.1 | ⬜ |
| 1.4 | Firebase Console: יצירת פרויקט + הגדרת שירותים | — | ⬜ |
| 1.5 | src/services/firebase/config.ts | 1.4 | ⬜ |
| 1.6 | Firebase Auth: login + register screens | 1.5 | ⬜ |
| 1.7 | Family: create + invite code flow | 1.6 | ⬜ |
| 1.8 | TypeScript types (src/types/*.ts) | — | ⬜ |
| 1.9 | Pet CRUD screens (add/edit/list/detail) | 1.7, 1.8 | ⬜ |
| 1.10 | Tab navigation + Expo Router layout | 1.9 | ⬜ |
| 1.11 | RTL + i18n (עברית + אנגלית) | 1.10 | ⬜ |
| 1.12 | Firestore Security Rules | 1.7 | ⬜ |

**הגדרת סיום:** שני משתמשים יכולים להתחבר, להצטרף לאותה Family, ולראות/לערוך את אותן חיות

---

## ספרינט 2 – רשומות בריאות + מזון (משוער: 12-14 שעות)

**מטרה:** כל סוגי הרשומות הבריאותיות ומעקב מזון עם real-time sync

| # | משימה | תלויות |
|---|---|---|
| 2.1 | Weight: form + history + line chart | ספרינט 1 |
| 2.2 | Medication: CRUD + regular vs temporary display | ספרינט 1 |
| 2.3 | Vaccine: CRUD + nextDueDate calculation | ספרינט 1 |
| 2.4 | Treatment: CRUD (deworming/flea/lice) + nextDueDate | ספרינט 1 |
| 2.5 | Appointment: CRUD + status transitions | ספרינט 1 |
| 2.6 | Food: CRUD + daily history + weekly chart | ספרינט 1 |
| 2.7 | custom hooks: usePets, useWeights, useMedications, useVaccines, useTreatments, useAppointments, useFood | 2.1-2.6 |
| 2.8 | Pet detail screen: tabs לכל הקטגוריות | 2.7 |

**הגדרת סיום:** שני מכשירים רואים אותם נתונים בזמן אמת

---

## ספרינט 3 – התראות (משוער: 8-10 שעות)

**מטרה:** push notifications לשני המכשירים לכל אירוע

| # | משימה | תלויות |
|---|---|---|
| 3.1 | Expo notifications permission + token registration | ספרינט 1 |
| 3.2 | FCM token → Firestore user document | 3.1 |
| 3.3 | Local notifications לתרופות יומיות | 3.1, ספרינט 2 |
| 3.4 | Firebase Cloud Functions: project init | ספרינט 1 |
| 3.5 | scheduledReminders Cloud Function (daily 07:00) | 3.4 |
| 3.6 | notifyFamily: fan-out FCM לכל המכשירים | 3.5 |
| 3.7 | nextDueDate maintenance בכתיבה | ספרינט 2 |
| 3.8 | Notification deep link → relevant screen | 3.6 |
| 3.9 | Notification settings screen | 3.8 |

**הגדרת סיום:** הוספת חיסון → שני המכשירים מקבלים push notification ב-30 יום לפני

---

## ספרינט 4 – Dashboard + UX (משוער: 6-8 שעות)

**מטרה:** ממשק מלוטש ו-dashboard שמראה כל מה שצריך ביום אחד

| # | משימה | תלויות |
|---|---|---|
| 4.1 | Dashboard: today's tasks + next 7 days | ספרינט 2, 3 |
| 4.2 | Pet cards עם status indicators (ירוק/צהוב/אדום) | 4.1 |
| 4.3 | Reminders screen: chronological all upcoming | ספרינט 3 |
| 4.4 | RTL polish: כל הממשק RTL בעברית | — |
| 4.5 | Empty states לכל המסכים | — |
| 4.6 | Pet photo upload (Firebase Storage) | ספרינט 1 |
| 4.7 | Language switch (עברית/אנגלית) בהגדרות | ספרינט 1 |
| 4.8 | App icon + Splash screen | — |

**הגדרת סיום:** אפליקציה ברמת production UX

---

## ספרינט 5 – בדיקות + תיעוד + פריסה (משוער: 4-6 שעות)

| # | משימה |
|---|---|
| 5.1 | Firestore security rules: אימות מלא |
| 5.2 | Error handling + offline state |
| 5.3 | EAS Build – Android APK/AAB |
| 5.4 | Internal testing via EAS או Google Play Internal Track |
| 5.5 | עדכון מסמכי תיעוד לגרסה סופית |
| 5.6 | עדכון סופי time-tracking + cost-tracking |

---

## סיכום שעות

| ספרינט | משוער (שעות) |
|---|---|
| ספרינט 1 | 8-10 |
| ספרינט 2 | 12-14 |
| ספרינט 3 | 8-10 |
| ספרינט 4 | 6-8 |
| ספרינט 5 | 4-6 |
| **סה"כ** | **38-48** |

---

## ניהול סיכונים

| סיכון | הסתברות | השפעה | מיטיגציה |
|---|---|---|---|
| Firebase setup מסובך | נמוכה | בינונית | הדרכה שלב-שלב במסמך 07 |
| iOS notifications לא נדרש (Android only) | — | — | מפשט את הפיתוח |
| RTL bugs בספריות צד שלישי | בינונית | נמוכה | בדיקה מוקדמת, פתרונות ידועים |
| Expo SDK incompatibility | נמוכה | גבוהה | נעבוד עם Expo SDK 55 (stable) |
