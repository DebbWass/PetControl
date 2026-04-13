# PetControl – מעקב עלויות

**תאריך פתיחה:** 2026-04-13

---

## עלויות Claude API

### תמחור Claude Sonnet 4.6 (נכון לאפריל 2026)

| מדד | מחיר |
|---|---|
| Input tokens | $3.00 לכל 1M tokens |
| Output tokens | $15.00 לכל 1M tokens |
| Cache write | $3.75 לכל 1M tokens |
| Cache read | $0.30 לכל 1M tokens |

### יומן Sessions

| # | תאריך | מטרת Session | מודל | Input Tokens (משוער) | Output Tokens (משוער) | עלות משוערת USD | הערות |
|---|---|---|---|---|---|---|---|
| 1 | 2026-04-13 | ארכיטקטורה + תכנון + מסמכי תיעוד | claude-sonnet-4-6 | ~12,000 | ~8,000 | ~$0.156 | Session תכנון ראשוני |
| 2 | 2026-04-13 | ספרינט 1: Init + types + Firebase + Pet CRUD | claude-sonnet-4-6 | — | — | — | *בביצוע* |

**הערה:** מספרי הטוקנים הם הערכות. לנתונים מדויקים – בדקי ב-Anthropic Console → Usage.

---

## סיכום עלויות

| קטגוריה | עלות משוערת |
|---|---|
| Claude API (כל הפרויקט) | $1.00 – $3.00 |
| Firebase (Spark – חינמי) | $0.00 |
| Expo EAS Build (Free tier) | $0.00 |
| Google Play Developer Account (חד-פעמי) | $25.00 (אופציונלי) |
| **סה"כ משוער** | **$1.00 – $28.00** |

---

## Firebase Spark Plan – מגבלות ושימוש

| שירות | מגבלה (Spark) | שימוש צפוי | סטטוס |
|---|---|---|---|
| Firestore reads | 50,000/יום | ~500/יום | ✅ בטוח |
| Firestore writes | 20,000/יום | ~50/יום | ✅ בטוח |
| Firestore deletes | 20,000/יום | ~5/יום | ✅ בטוח |
| Storage | 1 GB | ~10 MB | ✅ בטוח |
| FCM messages | ללא הגבלה | — | ✅ |
| Auth users | 10,000/חודש | 2 | ✅ בטוח |
| Cloud Functions invocations | 2M/חודש | ~60/חודש | ✅ בטוח |

**מסקנה:** הפרויקט ירוץ ב-Firebase חינמי לצמיתות בסקאלה המשפחתית הנוכחית.

---

## הנחיות עדכון

לאחר כל session:
1. עדכני את מספר ה-tokens בטבלה (ב-Anthropic Console → Usage)
2. חשבי עלות: `(input_tokens / 1,000,000 * 3) + (output_tokens / 1,000,000 * 15)`
3. עדכני סיכום עלויות כולל
