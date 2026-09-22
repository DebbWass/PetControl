# PetControl – מסמך ארכיטקטורה

**גרסה:** 1.0  
**תאריך:** 2026-04-13

---

## 1. Stack טכנולוגי

| שכבה | טכנולוגיה | גרסה |
|---|---|---|
| Runtime | Node.js | 24.x |
| Framework | React Native + Expo (Managed Workflow) | SDK 55 |
| Language | TypeScript | 5.x |
| Routing | Expo Router | 4.x |
| State | Zustand | 5.x |
| UI Library | React Native Paper (Material Design 3) | 5.x |
| Backend DB | Firebase Firestore | 10.x |
| Auth | Firebase Authentication (email/password) | 10.x |
| File Storage | Firebase Storage | 10.x |
| Push Notifications | Expo Notifications + FCM | latest |
| Cloud Functions | Firebase Cloud Functions (TypeScript) | Gen 2 |
| i18n | i18next + react-i18next | latest |
| Charts | react-native-chart-kit | latest |

---

## 2. ארכיטקטורה כללית

```
┌─────────────────────────────────────────────────┐
│              React Native App (Expo)             │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Screens │  │  Hooks   │  │ Zustand Store │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       └─────────────┴────────────────┘           │
│                     │                            │
│              Services Layer                      │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Firebase │  │Notification│  │  i18n RTL   │  │
│  │  Service │  │  Service   │  │   Service   │  │
│  └────┬─────┘  └────┬───────┘  └─────────────┘  │
└───────┼─────────────┼───────────────────────────┘
        │             │
        ▼             ▼
┌───────────────┐  ┌──────────────────────┐
│   Firebase    │  │   Device (local       │
│  ┌──────────┐ │  │   notifications)      │
│  │Firestore │ │  └──────────────────────┘
│  ├──────────┤ │
│  │   Auth   │ │
│  ├──────────┤ │
│  │ Storage  │ │
│  ├──────────┤ │
│  │   FCM    │ │
│  ├──────────┤ │
│  │Functions │ │
│  └──────────┘ │
└───────────────┘
```

---

## 3. מבנה Firestore

```
families/{familyId}
  ├── name: string
  ├── ownerUid: string
  ├── memberUids: string[]
  ├── inviteCode: string          // 6 תווים אלפא-נומריים
  ├── createdAt: Timestamp
  │
  ├── members/{userId}
  │     ├── uid: string
  │     ├── email: string
  │     ├── displayName: string
  │     ├── role: 'owner' | 'member'
  │     ├── fcmTokens: string[]   // מכשירים מרובים
  │     └── notificationPrefs: object
  │
  └── pets/{petId}
        ├── [fields Pet]
        │
        ├── weights/{weightId}
        │     └── [fields WeightRecord]
        │
        ├── medications/{medicationId}
        │     └── [fields Medication]
        │
        ├── vaccines/{vaccineId}
        │     └── [fields Vaccine]
        │
        ├── treatments/{treatmentId}
        │     └── [fields Treatment]
        │
        ├── appointments/{appointmentId}
        │     └── [fields Appointment]
        │
        └── food/{foodId}
              └── [fields FoodRecord]
```

**הסבר מבנה:** כל הנתונים מתחת ל-`families/{familyId}` – כלל Firestore Security Rules מוודאים שמשתמש רואה רק את ה-Family שלו.

---

## 4. ארכיטקטורת התראות

### שכבה 1 – Local Notifications (expo-notifications)

- מופעל ב-client בעת שמירת תרופה / חיסון / תור
- מתוזמן ב-device עצמו
- עובד offline
- מתאים ל: תרופות יומיות בשעה קבועה

### שכבה 2 – Cloud Push Notifications (Firebase Functions + FCM)

```
Cloud Scheduler (07:00 daily)
        │
        ▼
Firebase Cloud Function: scheduledReminders
        │
        ├── query Firestore: pets/*/vaccines where nextDueDate <= now+30d
        ├── query Firestore: pets/*/treatments where nextDueDate <= now+14d
        └── query Firestore: pets/*/appointments where scheduledDate <= now+2d
                │
                ▼
        notifyFamily(familyId, message)
                │
                ▼
        fetch all fcmTokens of all members
                │
                ▼
        FCM multicast → all devices of all family members
```

**יתרון:** שני בני הזוג מקבלים push notification גם אם האפליקציה לא נפתחה.

---

## 5. זרימת Authentication + Family

```
Register (owner)
    → Firebase Auth createUser
    → Firestore: create families/{newFamilyId}
    → Firestore: create families/{familyId}/members/{uid}
    → generate inviteCode (6 chars)

Register (member)
    → input inviteCode
    → query families where inviteCode == code
    → Firebase Auth createUser
    → Firestore: add uid to families/{familyId}.memberUids
    → Firestore: create families/{familyId}/members/{uid}
```

---

## 6. RTL ו-i18n

- `I18nManager.forceRTL(true)` ב-app startup כשהשפה עברית
- כל הטקסטים ב-`src/constants/strings.ts` (key-value)
- i18next עם שני namespace: `he` (ברירת מחדל), `en`
- החלפת שפה בזמן ריצה מ-Settings screen (דורש restart קצר לRTL)
- תאריכים: `date-fns/locale/he` לעברית

---

## 7. Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // user can only access their own family
    function isFamilyMember(familyId) {
      return request.auth != null &&
        request.auth.uid in get(/databases/$(database)/documents/families/$(familyId)).data.memberUids;
    }

    match /families/{familyId} {
      allow read, write: if isFamilyMember(familyId);

      match /{subcollection}/{docId} {
        allow read, write: if isFamilyMember(familyId);

        match /{subSubcollection}/{subDocId} {
          allow read, write: if isFamilyMember(familyId);
        }
      }
    }
  }
}
```

---

## 8. Offline Strategy

- Firestore SDK כולל local cache אוטומטי
- `enableIndexedDbPersistence()` ב-web / `enablePersistence()` ב-mobile
- בעת offline: קריאות מ-cache, כתיבות נשמרות ב-queue ומסתנכרנות בחזרה לאינטרנט
- UI: אינדיקטור "אין חיבור" ב-banner עליון

---

## 9. ייצוא תיק רפואי ל-PDF

ייצוא של כל נתוני החיה למסמך A4 מקצועי, עם שיתוף והדפסה. נקודת הכניסה היא תפריט שלוש הנקודות במסך פרופיל החיה (`app/pet/[id].tsx`).

### חלוקת המודולים (`src/services/pdf/`)

| קובץ | תפקיד | טהור? |
|---|---|---|
| `types.ts` | מודלי תצוגה לדוח (`Date` רגיל, לא `Timestamp`) | ✔ |
| `weightChartSvg.ts` | בניית גרף המשקל כ-SVG inline | ✔ |
| `medicalReportHtml.ts` | בניית מסמך ה-HTML המלא בגודל A4 | ✔ |
| `medicalReportData.ts` | איסוף חד-פעמי מ-Firestore + הטמעת התמונה | ✘ |
| `exportMedicalReport.ts` | תזמור: איסוף → HTML → PDF → שיתוף/הדפסה | ✘ |

**למה "טהור" חשוב:** תצורת jest בפרויקט היא `testEnvironment: "node"`, ולכן כל מודול שמייבא react-native או expo אינו בר-בדיקה. שני הבילדרים מקבלים מתאם `ReportLabels` מוזרק (`t`, `formatDate`, `formatDateTime`, `isRTL`, `lang`) במקום לייבא את i18n ישירות — המסך מעביר את הפונקציות האמיתיות, הבדיקות מעבירות stubs.

### איסוף הנתונים

`collectMedicalReportData()` קורא את שבע תת-הקולקציות ב-`Promise.all` אחד באמצעות `getRecords()` (ב-`firestore.ts`).

**במכוון לא נעשה שימוש ב-hooks של `useHealthRecords.ts`** — הם מנויי `onSnapshot` חיים, ו-`useMedications` מסנן ל-`isActive == true` בעוד שהדוח צריך גם תרופות שהופסקו.

- **מזון** מוגבל ל-30 הרשומות האחרונות (`FOOD_RECORD_LIMIT`) + ספירה כוללת דרך `getCountFromServer`. שאר הקטגוריות מיוצאות במלואן.
- **תמונת החיה** מוטמעת כ-base64 data URI, כדי שה-PDF ייראה זהה גם ללא רשת. כל כשל נופל חזרה לאמוג'י של המין.
- `getCountFromServer` דורש round trip לשרת ולכן נכשל offline — הקוד נופל חזרה לגודל העמוד שנקרא.

### אילוצי הדפסה (Android WebView / Chromium)

- חובה להעביר גודל דף במפורש: `printToFileAsync({ width: 595, height: 842 })`. ברירת המחדל היא US Letter.
- `<thead>` חוזר אוטומטית כשטבלה נשברת בין עמודים; `tr { page-break-inside: avoid }` מונע חיתוך שורה.
- אלמנט `position: fixed` חוזר בכל עמוד — כך מיושם ה-footer.
- **אין מספרי עמודים.** מנוע ההדפסה של WebView אינו תומך ב-`@page` margin boxes או ב-`counter(page)`.
- גופן Heebo נטען מ-Google Fonts; במצב offline המערכת נופלת חזרה לגופן העברי של המכשיר.

### מודולים נייטיביים

`expo-print`, `expo-sharing` ו-`expo-file-system` נדרשים ב-`require` עצל בתוך try/catch (אותה תבנית כמו `expo-document-picker` ב-`medical-file.tsx`), כך ש-dev client שנבנה לפני ההתקנה מציג הודעה ברורה במקום לקרוס.

ב-SDK 54 הפונקציות `downloadAsync` / `copyAsync` / `readAsStringAsync` נמצאות ב-`expo-file-system/legacy`.
