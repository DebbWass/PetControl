# PetControl – מעקב שעות עבודה

**הנחיות:** רשמי שורה חדשה לכל session עבודה. עדכני את "שעות מצטברות" בסוף.

---

## יומן עבודה

| # | תאריך | ספרינט | תיאור משימה | שעות | הערות |
|---|---|---|---|---|---|
| 1 | 2026-04-13 | תכנון | ארכיטקטורה, תכנון, מסמכי תיעוד (docs 01–06) | ~2.0 | Session תכנון ראשוני עם Claude |
| 2 | 2026-04-13 | ספרינט 1 | Init Expo, TypeScript types, Firebase Auth/Firestore, Pet CRUD, Tab Navigation, i18n RTL, Security Rules | ~5.0 | Commit a65dd6e – 36 קבצים, 3,111 שורות |
| 3 | 2026-04-14 | ספרינט 2 | nextDueDate auto-calc, weekly food BarChart, medication frequency form, vaccine picker עם COMMON_VACCINES | ~4.0 | שינויים ב-medications.tsx, vaccines.tsx, food.tsx |
| 4 | 2026-04-14 | ספרינט 3 | FCM token registration, local notification scheduler, Cloud Functions daily reminder | ~3.5 | services/notifications.ts, functions/src/index.ts, עדכון _layout.tsx |
| 5 | 2026-04-14 | ספרינט 4 | Dashboard (today/upcoming/overdue), pet photo upload (Storage), Settings notification prefs + language restart | ~3.5 | useDashboard.ts, storage.ts, עדכון index.tsx + reminders.tsx + settings.tsx |
| 6 | 2026-04-14 | ספרינט 5 | EAS build config (eas.json), app.json v1.2.0, firestore.indexes.json | ~0.5 | הכנה לבנייה |

---

## סיכום לפי ספרינט

| ספרינט | שעות שהושקעו | שעות משוערות | % מהיעד |
|---|---|---|---|
| תכנון + תיעוד | 2.0 | 2.0 | 100% |
| ספרינט 1 | 5.0 | 8–10 | 56% ✅ |
| ספרינט 2 | 4.0 | 12–14 | 31% ✅ |
| ספרינט 3 | 3.5 | 8–10 | 41% ✅ |
| ספרינט 4 | 3.5 | 6–8 | 50% ✅ |
| ספרינט 5 | 0.5 | 4–6 | 10% 🔄 |
| **סה"כ** | **18.5** | **40–50** | **~43%** |

> **הערה:** הספרינטים הושלמו מהר יותר מהמשוער כי Claude ביצע את כתיבת הקוד. שעות העבודה האנושיות (בדיקה, Firebase Console, הגדרות) עשויות להיות גבוהות יותר.

---

## נותר לביצוע ידני

| פעולה | שעות משוערות |
|---|---|
| `eas login && eas build:configure` | 0.5 |
| Firebase Console: Deploy functions + indexes | 1.0 |
| `eas build -p android --profile preview` → בדיקת APK | 1.0 |
| בדיקת אפליקציה על שני מכשירים | 1.5 |
| **סה"כ** | **~4 שעות** |

---

## הנחיות עדכון

בתחילת כל session:
1. הוסיפי שורה חדשה עם תאריך + תיאור
2. אמדי שעות בסיום

בסיום כל session:
1. עדכני שעות + הערות
2. עדכני טבלת סיכום
