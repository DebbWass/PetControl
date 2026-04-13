# PetControl – מעקב עלויות

**תאריך פתיחה:** 2026-04-13  
**עדכון אחרון:** 2026-04-14

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
| 1 | 2026-04-13 | תכנון ארכיטקטורה + מסמכי תיעוד | claude-sonnet-4-6 | ~12,000 | ~8,000 | ~$0.156 | Plan mode + Explore + Plan agents |
| 2 | 2026-04-13 | ספרינט 1: Init + types + Firebase + CRUD + i18n | claude-sonnet-4-6 | ~18,000 | ~14,000 | ~$0.264 | 36 קבצים חדשים, 3,111 שורות |
| 3 | 2026-04-14 | ספרינטים 2–5: health records, notifications, dashboard, EAS | claude-sonnet-4-6 | ~22,000 | ~16,000 | ~$0.306 | שינויים ב-12+ קבצים |
| **סה"כ** | | | | **~52,000** | **~38,000** | **~$0.726** | |

> **⚠️ אלו הערכות בלבד.** לנתונים מדויקים: [console.anthropic.com](https://console.anthropic.com) → Usage → בחרי תאריכים 13-14/04/2026

**נוסחת חישוב:**
```
עלות = (input_tokens / 1,000,000 × $3.00) + (output_tokens / 1,000,000 × $15.00)
```

---

## סיכום עלויות כולל הפרויקט

| קטגוריה | עלות בפועל / משוערת |
|---|---|
| Claude API – Sessions 1–3 (עד היום) | ~$0.73 |
| Claude API – Sessions עתידיות (בדיקות, תיקונים) | ~$0.20–$0.50 |
| Firebase (Spark Plan) | **$0.00** |
| Expo EAS Build (Free tier – עד 30 builds/חודש) | **$0.00** |
| Google Play Developer Account (חד-פעמי, אופציונלי) | $25.00 |
| **סה"כ ללא Play Store** | **~$0.73–$1.23** |
| **סה"כ כולל Play Store** | **~$25.73–$26.23** |

---

## Firebase Spark Plan – מגבלות ושימוש

| שירות | מגבלה (Spark) | שימוש צפוי | סטטוס |
|---|---|---|---|
| Firestore reads | 50,000/יום | ~500/יום | ✅ בטוח |
| Firestore writes | 20,000/יום | ~50/יום | ✅ בטוח |
| Firestore deletes | 20,000/יום | ~5/יום | ✅ בטוח |
| Storage | 1 GB | ~50 MB (תמונות חיות) | ✅ בטוח |
| FCM messages | ללא הגבלה | ~30/יום | ✅ |
| Auth users | 10,000/חודש | 2 | ✅ בטוח |
| Cloud Functions invocations | 2M/חודש | ~60/חודש (daily + triggers) | ✅ בטוח |

**מסקנה:** הפרויקט ירוץ ב-Firebase חינמי לצמיתות בסקאלה המשפחתית הנוכחית.

---

## הנחיות עדכון

לאחר כל session:
1. עדכני את מספר ה-tokens בטבלה (ב-Anthropic Console → Usage)
2. חשבי עלות: `(input / 1M × $3) + (output / 1M × $15)`
3. עדכני עלות כוללת בטבלת סיכום
