# PetControl – תוכנית מונטיזציה ותשתית תשלום

מסמך תכנון (Spec) למעבר האפליקציה למודל חינמי/פרימיום, כולל מעבר תשתית Firebase מ‑Spark ל‑Blaze, שינויי קוד נדרשים, אינטגרציית תשלום, ואבטחה.

> **סטטוס:** מסמך החלטות + תכנון מימוש. חלק מהפריטים כבר בוצעו (מסומנים ✅), רובם עדיין לפני מימוש (🔵).
>
> **הערת מחירים:** כל הסכומים כאן הם להערכת סדר גודל ונכונים למיטב הידע נכון לתחילת 2026. מחירי Firebase / Google Play / RevenueCat משתנים — יש לאמת מול דפי התמחור הרשמיים לפני החלטה סופית.

---

## 1. עקרון־העל: מה באמת מייקר, ומה כמעט חינם

ההחלטות בהמשך נגזרות מעיקרון אחד: **התמחור רודף אחרי הדאטה, לא אחרי מספר המשתמשים.**

| מה | משפיע על העלות? | הסבר |
|---|---|---|
| קבצים בתיק הרפואי (PDF/תמונות) | 🔴 גבוה | קבצים כבדים (5–20MB), אחסון + תעבורת הורדה |
| תמונות פרופיל של חיות | 🟠 בינוני → **טופל** | הוקטנו ל‑512px (ראה §3) |
| מספר חיות | 🟡 נמוך־בינוני | עוד רשומות + עוד קבצים פוטנציאליים |
| מספר בני משפחה | 🟢 זניח | חברים **חולקים** את אותו מידע; חבר נוסף = רק עוד קריאות + push |
| רשומות טקסט (תרופות, חיסונים וכו') | 🟢 זניח | טקסט זעיר |

**המסקנה:** מנוי אחד **למשפחה** (לא לכל משתמש), ושערי־תשלום (gates) על מה שמייקר — קבצים וכמות חיות.

---

## 2. מבנה החבילות (Plans)

### 2.1 מודל תמחור — מנוי אחד למשפחה

בחרנו **per‑family** ולא **per‑seat**, משתי סיבות:
1. **עלות:** חבר משפחה נוסף כמעט לא עולה כלום (חולק את אותו `families/{id}`).
2. **שוק:** אפליקציות משפחתיות (Spotify Family, Apple One, Life360) תמיד מתמחרות "לפי בית". תשלום per‑seat מרגיש כמו עונש על שיתוף ומרתיע אימוץ.

### 2.2 טבלת החבילות

| יכולת | Free | Premium (מחיר אחד למשפחה) |
|---|---|---|
| חיות | 1 | ללא הגבלה |
| בני משפחה מחוברים | 1 | עד 6 |
| העלאת קבצים לתיק רפואי | ❌ | ✅ |
| צפייה בקבצים קיימים | ✅ | ✅ |
| תמונות פרופיל (מוקטנות) | ✅ | ✅ |
| רשומות בריאות (תרופות/חיסונים/משקל/מזון) | ✅ | ✅ |
| תזכורות ו‑push | ✅ | ✅ |

**הערות:**
- מגבלת "עד 6 חברים" אינה בגלל עלות אלא למניעת ניצול לרעה (שלא ייווצרו "משפחות" של עשרות זרים על מנוי אחד).
- קבצים קיימים בתיק הרפואי נשארים לצפייה גם אם המשפחה יורדת ל‑Free — רק **העלאה** של חדשים נחסמת.

### 2.3 נקודת מחיר (להחלטה)

- מומלץ **מנוי שנתי** (למשל ₪39–59/שנה) על פני חודשי — צרכן פרטי מעדיף תשלום שנתי נמוך על "עוד מנוי חודשי".
- אפשר להוסיף מנוי חודשי במקביל (למשל ₪7–9/חודש) כאופציה.
- עמלת Google Play: כ‑**15%** (עד הכנסה שנתית של $1M).

---

## 3. מה כבר בוצע ✅ – הקטנת רזולוציית תמונות פרופיל

**קובץ:** `src/services/storage.ts`
**חבילה שנוספה:** `expo-image-manipulator` (~14.0.8, תואם SDK 54)

- כל תמונת פרופיל מוקטנת ל‑**512px** ומקודדת מחדש כ‑**JPEG** (`compress: 0.7`) **לפני** ההעלאה, בתוך `uploadPetPhoto` (נקודת מעבר יחידה לשני מסכי היצירה/עריכה).
- **התיק הרפואי לא מושפע** — צילומי רנטגן ובדיקות נשארים ברזולוציה מלאה (מכוון; יש הערה בקוד).
- הנתיב אוחד ל‑`photo.jpg` קבוע (במקום סיומת דינמית) — מונע קבצים יתומים.

**השפעה:** תמונת פרופיל של ~2–3MB → ~40–80KB (**חיסכון פי 25–40**), באחסון ובתעבורת הורדה, לכל המשתמשים כולל חינמיים.

**דרוש כדי לוודא:** dev build (מודול נייטיב — לא רץ ב‑Expo Go). לבדוק ב‑Firebase Console → Storage שגודל `photo.jpg` הוא עשרות KB.

---

## 4. מעבר תשתית: Spark → Blaze

### 4.1 למה זה הכרחי (ולא רק בגלל תשלום)

- **Cloud Functions דורשות Blaze.** ה‑Function `sendDailyReminders` (תזכורות יומיות ב‑07:00) **לא רץ בכלל** ב‑Spark. כלומר המעבר נדרש ממילא כבר להשקה, בלי קשר למונטיזציה.
- Blaze הוא **pay‑as‑you‑go**: מכסות החינם של Spark **ממשיכות לחול**, ומשלמים **רק** על חריגה מעליהן.

### 4.2 מכסות החינם (נשארות גם ב‑Blaze)

| שירות | מכסת חינם (יומית/חודשית) |
|---|---|
| Firestore קריאות | 50K ליום |
| Firestore כתיבות | 20K ליום |
| Firestore מחיקות | 20K ליום |
| Firestore אחסון | 1 GiB |
| Cloud Storage אחסון | 5 GB |
| Cloud Storage הורדה | 1 GB ליום |
| Cloud Functions הרצות | 2M לחודש |

### 4.3 עלויות מעבר למכסה (הערכה, לאימות)

| משאב | עלות מעל החינם |
|---|---|
| Firestore קריאות | ~$0.06 ל‑100K |
| Firestore כתיבות | ~$0.18 ל‑100K |
| Firestore אחסון | ~$0.18 ל‑GiB לחודש |
| Cloud Storage אחסון | ~$0.026 ל‑GB לחודש |
| Cloud Storage הורדה | ~$0.12 ל‑GB |
| Cloud Functions | 2M הרצות חינם, זניח אח"כ |

### 4.4 דוגמה מספרית (≈1,000 משפחות פעילות)

- רשומות טקסט: שברי GiB → כמה סנטים.
- תמונות פרופיל (אחרי ההקטנה): 1,000 × ~60KB ≈ 60MB → סנטים בודדים.
- תיק רפואי (רק פרימיום): המשתנה העיקרי; תלוי בכמות המנויים ובגודל הקבצים.
- **צפי:** נשארים ברובו בתוך מכסות החינם; חשבון של **0–כמה דולרים בחודש** עד עשרות אלפי משתמשים פעילים — ואז ההכנסות כבר מכסות בקלות.

### 4.5 שלבי המעבר בפועל

1. **Firebase Console** → הפרויקט → תפריט תחתון **"Upgrade" / Spark → Blaze**.
2. לקשר **Cloud Billing account** (כרטיס אשראי) או ליצור חדש.
3. **להגדיר Budget + Alerts** ב‑Google Cloud Console → Billing → Budgets & alerts (למשל התראה ב‑$10, $50, $100).
   - ⚠️ **חשוב:** Budget alert רק **מתריע**, לא **חוסם** חיוב. לחסימה קשיחה צריך אוטומציה (Cloud Function שמכבה billing בחריגה) — מתקדם, אופציונלי לשלב מאוחר.
4. אחרי המעבר: `cd functions && npm run build && firebase deploy --only functions` — לוודא שה‑scheduler עלה ורץ.

**דרוש:** גישת בעלים לפרויקט Firebase, כרטיס אשראי לחשבון החיוב.

---

## 5. שינויי מודל נתונים

### 5.1 שדות פרימיום על מסמך `Family`

הפרימיום חי על **המשפחה**, לא על המשתמש (ראה §2.1). הרחבת `Family` (`src/types/index.ts`):

```ts
export interface Family {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  inviteCode: string;
  createdAt: Timestamp;
  // ── חדש ──
  plan: 'free' | 'premium';        // ברירת מחדל: 'free'
  planSince?: Timestamp;           // מתי שודרג
  planExpiresAt?: Timestamp;       // תוקף המנוי (מ‑RevenueCat)
  planStore?: 'play' | 'manual';   // מקור ההרשאה
  petCount?: number;               // מונה חיות – לאכיפת מגבלה ב‑rules (§8)
}
```

- ברירת מחדל בעת יצירת משפחה (`auth.ts`): `plan: 'free'`, `petCount: 0`.
- `petCount` מתוחזק בכל יצירה/מחיקה של חיה (או דרך Cloud Function — ראה §8).

### 5.2 מקור אמת יחיד למגבלות

קובץ חדש `src/constants/plans.ts`:

```ts
export const PLAN_LIMITS = {
  free:    { maxPets: 1,        maxMembers: 1, medicalUpload: false },
  premium: { maxPets: Infinity, maxMembers: 6, medicalUpload: true  },
} as const;
```

Hook נגזר `src/hooks/usePlan.ts` שמחזיר את החבילה של המשפחה הנוכחית + המגבלות שלה, לצריכה בכל מסך.

---

## 6. שערי־תשלום בקוד (Client‑side Gates)

שלושה מקומות, כולם קוראים ל‑`usePlan()` ומציגים מסך שדרוג (upsell) כשחורגים:

| # | מגבלה | קובץ | נקודה | התנהגות בחריגה |
|---|---|---|---|---|
| 1 | חיות | `app/pet/new.tsx` | `handleSave` / כפתור הוספה | חסימת יצירה מעל `maxPets` → מסך שדרוג |
| 2 | חברי משפחה | `src/services/firebase/auth.ts` | `joinFamily` (הצטרפות עם inviteCode) | חסימה מעל `maxMembers` → הודעת שדרוג |
| 3 | קובץ רפואי | `app/pet/[id]/medical-file.tsx` | ה‑FAB `+` (שורה ~229) | אם `!medicalUpload` → מסך שדרוג במקום דיאלוג |

**רכיב חדש:** `PaywallScreen` / `UpgradeSheet` — מסך/גיליון שמסביר את יתרונות הפרימיום ומפעיל את רכישת ה‑RevenueCat (§7).

> ⚠️ שערי הלקוח הם ל‑UX בלבד. לקוח שעבר מניפולציה יכול לעקוף אותם — לכן **חובה** אכיפה גם בצד שרת (Firestore Rules, §8).

---

## 7. אינטגרציית תשלום – RevenueCat + Google Play

### 7.1 למה RevenueCat

- ב‑Android **חובה** Google Play Billing למוצרים דיגיטליים (אסור לגבות ישירות בכרטיס/PayPal).
- RevenueCat עוטף את Play Billing, מנהל entitlements, מספק webhooks, ומטפל בחידושים/ביטולים.
- **עלות:** חינם עד ~$2,500 הכנסה חודשית (MTR), אחר כך מדורג.
- **חבילה:** `react-native-purchases` (+ config plugin ל‑Expo; דורש dev build, כבר קיים אצלנו).

### 7.2 שלבי הקמה

**א. Google Play Console**
1. חשבון מפתח ($25 חד‑פעמי) — אם עוד אין.
2. יצירת **Subscription product** (base plan + offers), למשל `premium_yearly`, `premium_monthly`.
3. יצירת **Service Account** והרשאות ל‑RevenueCat לקרוא/לאמת רכישות.

**ב. RevenueCat**
1. פתיחת חשבון + פרויקט.
2. חיבור אישורי ה‑Service Account מ‑Play.
3. הגדרת **Entitlement** אחד, למשל `premium`, וקישורו למוצרים.
4. הגדרת **Webhook** → אל Cloud Function שלנו (§7.4).

**ג. אפליקציה**
1. `npx expo install react-native-purchases` + הוספת ה‑plugin ל‑`app.json`.
2. אתחול RevenueCat ב‑`_layout.tsx` עם API key, וזיהוי המשתמש (`Purchases.logIn(uid)` — או שימוש ב‑`familyId` כ‑App User ID כדי לקשר ישירות למשפחה).
3. מסך ה‑Paywall קורא ל‑`Purchases.getOfferings()` ומציג מחירים; רכישה דרך `Purchases.purchasePackage()`.

### 7.3 קישור רכישה → משפחה

הבעלים (`ownerUid`) רוכש בחשבון הגוגל שלו, אבל ההרשאה חלה על **כל המשפחה**:
- אפשרות מומלצת: להשתמש ב‑`familyId` כ‑**App User ID** ב‑RevenueCat, כך שה‑entitlement שייך למשפחה מלכתחילה.

### 7.4 Cloud Function ל‑Webhook

Function חדש (Gen 2, HTTPS) שמקבל webhook מ‑RevenueCat ומעדכן את מסמך המשפחה עם **Admin SDK** (עוקף rules):

```
RevenueCat webhook  →  functions/src (HTTPS)  →  families/{familyId}.plan = 'premium'
                                                  planExpiresAt = <expiry>
```

- מטפל באירועים: `INITIAL_PURCHASE`, `RENEWAL` → premium; `EXPIRATION`, `CANCELLATION` → free.
- **דרוש:** אימות חתימת ה‑webhook (secret) כדי שלא יזייפו שדרוג.

---

## 8. אבטחה – אכיפת שרת (Firestore Rules)

`firestore.rules` — כדי שלקוח לא יעקוף את שערי §6:

1. **הגנת שדה `plan`:** לקוח **לא** יכול לכתוב `plan` / `planExpiresAt` על מסמך המשפחה. רק ה‑Admin SDK (מה‑webhook) מעדכן אותם.
2. **מגבלת חברים:** ב‑update ל‑`memberUids` לאסור חריגה — לדוגמה:
   `allow update: ... && (family.plan == 'premium' || request.resource.data.memberUids.size() <= 1)`
   (rules תומכים ב‑`.size()` על מערכים — אכיף ישירות).
3. **מגבלת חיות:** rules לא סופרים תת‑אוסף ישירות. שתי אפשרויות:
   - **(מומלץ)** מונה `petCount` על מסמך המשפחה, מתוחזק ב‑Cloud Function/transaction; הכלל בודק `family.plan == 'premium' || family.petCount < 1`.
   - או יצירת חיה דרך **Callable Function** שאוכפת את המגבלה בצד שרת.
4. **קובץ רפואי:** אכיפה ב‑**Storage Rules** + ב‑Firestore rules של תת‑אוסף `documents` — יצירה מותרת רק אם `family.plan == 'premium'`.

**דרוש:** `firebase deploy --only firestore:rules` (ו‑storage rules אם נוגעים בהן).

---

## 9. סדר ביצוע מומלץ (Rollout)

| שלב | תוכן | תלוי ב־ | סטטוס |
|---|---|---|---|
| 0 | הקטנת תמונות פרופיל | — | ✅ בוצע |
| 1 | מעבר Spark → Blaze + budget alerts + deploy functions | גישת בעלים + כרטיס | 🔵 |
| 2 | מודל נתונים: שדה `plan`, `PLAN_LIMITS`, `usePlan()` | — | 🔵 |
| 3 | שערי לקוח (§6) + מסך Paywall (UI בלבד, עדיין בלי רכישה) | שלב 2 | 🔵 |
| 4 | Google Play subscription + RevenueCat + purchase flow + webhook function | Blaze, Play account | 🔵 |
| 5 | אכיפת שרת: Firestore/Storage rules (§8) | שלב 2–4 | 🔵 |
| 6 | QA (עדכון `STP.md` / `STR.md`) + השקה | הכל | 🔵 |

> ניתן לפצל: שלבים 2–3 מספקים ערך (מגבלות + מסכי שדרוג) גם לפני שמנגנון התשלום מוכן — פשוט בלי אפשרות לשלם עדיין. את שלבי 4–5 מוסיפים כשמפעילים גבייה בפועל.

---

## 10. דרישות מרוכזות (Checklist)

**חשבונות / הרשאות**
- [ ] גישת Owner ל‑Firebase + כרטיס אשראי לחשבון חיוב (Blaze)
- [ ] חשבון מפתח Google Play ($25 חד‑פעמי)
- [ ] חשבון RevenueCat
- [ ] Service Account שמקשר Play ↔ RevenueCat

**חבילות תוכנה**
- [x] `expo-image-manipulator` (בוצע)
- [ ] `react-native-purchases` (+ config plugin)

**קוד**
- [ ] הרחבת `Family` type + ברירות מחדל ב‑`auth.ts`
- [ ] `src/constants/plans.ts` + `src/hooks/usePlan.ts`
- [ ] שערים ב‑`pet/new.tsx`, `auth.ts` (joinFamily), `medical-file.tsx`
- [ ] רכיב `Paywall/UpgradeSheet` + אתחול RevenueCat ב‑`_layout.tsx`
- [ ] Cloud Function ל‑RevenueCat webhook
- [ ] עדכון `firestore.rules` (+ storage rules) ופריסה

**תפעול**
- [ ] Budget alerts ב‑Google Cloud
- [ ] דרישה ל‑dev build חדש (מודולים נייטיביים: image‑manipulator, purchases)
- [ ] עדכון תיעוד QA (`STP.md`, `STR.md`)

---

## 11. סיכום ההחלטות

1. **מנוי אחד למשפחה**, לא per‑seat.
2. **Free:** חיה 1, חבר 1, ללא העלאת קבצים לתיק רפואי.
3. **Premium:** חיות ללא הגבלה, עד 6 חברים, העלאת קבצים.
4. **תמחור:** מומלץ מנוי שנתי (₪39–59/שנה); עמלת Play ~15%.
5. **תמונות פרופיל** מוקטנות ל‑512px — כבר בוצע, חוסך לכולם.
6. **תיק רפואי** נשאר ברזולוציה מלאה (איכות אבחון), אך העלאה נחסמת ל‑Free.
7. **הפרימיום חי על מסמך המשפחה**, מעודכן רק דרך webhook מאובטח.
8. **אכיפה כפולה:** שערי UX בלקוח + אכיפה קשיחה ב‑Firestore/Storage rules.
