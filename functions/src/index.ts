import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';

admin.initializeApp();
const db = admin.firestore();

// ─── AI Pet Assistant ─────────────────────────────────────────────────────────
// Proxies to Claude API so the API key stays server-side.
// Set the key: firebase functions:secrets:set ANTHROPIC_API_KEY
// (or via Firebase Console → Functions → Secrets)

// Per-user daily cap on AI questions. Each question costs money at the Claude
// API, so this protects against runaway bills / abuse from a single account.
const AI_DAILY_LIMIT = 20;

export const askPetAI = onCall(
  {
    region: 'europe-west1',
    secrets: ['ANTHROPIC_API_KEY'],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    const uid = request.auth.uid;

    const { message, petContext, language } = request.data as {
      message: string;
      petContext: string;
      language: string;
    };

    if (!message?.trim()) {
      throw new HttpsError('invalid-argument', 'message is required');
    }

    // Rate limit: atomically bump this user's daily counter, rejecting once the
    // cap is hit. Stored in a server-only collection (no client access).
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const usageRef = db.doc(`aiUsage/${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const data = (snap.exists ? snap.data() : {}) as { date?: string; count?: number };
      const count = data.date === today ? (data.count ?? 0) : 0;
      if (count >= AI_DAILY_LIMIT) {
        throw new HttpsError('resource-exhausted', 'DAILY_AI_LIMIT_REACHED');
      }
      tx.set(usageRef, { date: today, count: count + 1 });
    });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const isHebrew = language === 'he';

    const systemPrompt = isHebrew
      ? `אתה עוזר וטרינרי מועיל ומקצועי. אתה עוזר לבעלי חיות מחמד עם שאלות על בריאות, תרופות וטיפולים.
תמיד ענה בעברית. תמיד המלץ להתייעץ עם וטרינר לגבי החלטות רפואיות.
אל תיתן אבחנות רפואיות מוגדרות. ספק מידע כללי ומועיל.
אם יש מידע על החיה, קח אותו בחשבון.`
      : `You are a helpful and professional veterinary assistant. You help pet owners with questions about health, medications, and treatments.
Always respond in English. Always recommend consulting a veterinarian for medical decisions.
Do not provide definitive medical diagnoses. Provide general, helpful information.
If pet information is provided, take it into account.`;

    const userMessage = petContext
      ? `[Context about the pet: ${petContext}]\n\n${message}`
      : message;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return { response: text };
  }
);

// ─── Account deletion (GDPR / Google Play compliance) ─────────────────────────
// Runs with Admin privileges so it can recursively delete sub-collections and
// remove the Firebase Auth user without requiring a recent re-login.
//
// Behaviour depends on family membership:
//  • Last remaining member  → the whole family (pets, records, documents,
//    Storage files) is permanently deleted.
//  • Other members remain   → the user simply leaves the family; shared data is
//    kept for the others. Ownership is handed to another member if needed.

export const deleteAccount = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }
    const uid = request.auth.uid;

    const userIndexRef = db.doc(`users/${uid}`);
    const userIndexSnap = await userIndexRef.get();

    if (userIndexSnap.exists) {
      const { familyId } = (userIndexSnap.data() ?? {}) as { familyId?: string };

      if (familyId) {
        const familyRef = db.doc(`families/${familyId}`);
        const familySnap = await familyRef.get();

        if (familySnap.exists) {
          const family = (familySnap.data() ?? {}) as {
            memberUids?: string[];
            ownerUid?: string;
          };
          const memberUids = family.memberUids ?? [];
          const otherMembers = memberUids.filter((m) => m !== uid);

          if (otherMembers.length === 0) {
            // Last member — permanently delete the whole family tree.
            await db.recursiveDelete(familyRef);
            // Remove associated Storage files (pet photos, medical documents).
            // Target the bucket explicitly — this project uses the newer
            // *.firebasestorage.app naming, not the default *.appspot.com.
            await admin
              .storage()
              .bucket('petcontrol-ac39f.firebasestorage.app')
              .deleteFiles({ prefix: `families/${familyId}/` })
              .catch((e) => {
                console.error(`Storage cleanup failed for family ${familyId}:`, e);
              });
          } else {
            // Other members remain — remove this user from the family only.
            const updates: Record<string, unknown> = {
              memberUids: FieldValue.arrayRemove(uid),
            };
            // Hand ownership to another member if this user was the owner.
            if (family.ownerUid === uid) {
              updates.ownerUid = otherMembers[0];
            }
            await familyRef.update(updates);
            await db.doc(`families/${familyId}/members/${uid}`).delete().catch(() => {});
          }
        }
      }

      await userIndexRef.delete().catch(() => {});
    }

    // Delete the Firebase Auth account last, once data cleanup has succeeded.
    await admin.auth().deleteUser(uid);

    return { success: true };
  }
);

// ─── Scheduled daily reminders ────────────────────────────────────────────────
// Runs at 08:00 Israel time (06:00 UTC) every day.

export const sendDailyReminders = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'Asia/Jerusalem',
    region: 'europe-west1',
  },
  async () => {
    const familiesSnap = await db.collection('families').get();

    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;

      // Gather FCM tokens + notification prefs from all family members
      const membersSnap = await db
        .collection(`families/${familyId}/members`)
        .get();

      const tokens: string[] = [];
      let quietStart = '22:00';
      let quietEnd = '08:00';
      let prefs: Record<string, boolean> = {};

      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        (member.fcmTokens as string[] | undefined ?? []).forEach((t) => tokens.push(t));
        quietStart = member.notificationPrefs?.quietStart ?? '22:00';
        quietEnd = member.notificationPrefs?.quietEnd ?? '08:00';
        if (member.notificationPrefs) prefs = member.notificationPrefs;
      }

      if (tokens.length === 0) continue;
      if (isQuietHour(quietStart, quietEnd)) continue;

      // Query active pets
      const petsSnap = await db
        .collection(`families/${familyId}/pets`)
        .where('isActive', '==', true)
        .get();

      for (const petDoc of petsSnap.docs) {
        const petId = petDoc.id;
        const petName = petDoc.data().name as string;

        // ── Medications due today ─────────────────────────────────────
        if (prefs.medications !== false) {
          const todayStart = startOfDay();
          const todayEnd = endOfDay();
          const medsSnap = await db
            .collection(`families/${familyId}/pets/${petId}/medications`)
            .where('isActive', '==', true)
            .where('reminderEnabled', '==', true)
            .where('nextDueDate', '>=', Timestamp.fromDate(todayStart))
            .where('nextDueDate', '<=', Timestamp.fromDate(todayEnd))
            .get();

          for (const medDoc of medsSnap.docs) {
            const m = medDoc.data();
            await sendToTokens(tokens, {
              title: `💊 ${petName}`,
              body: `תרופה: ${m.name as string} – ${m.dosage as string}`,
              data: { route: `/pet/${petId}/medications` },
            });
          }
        }

        // ── Vaccines due soon ─────────────────────────────────────────
        if (prefs.vaccines !== false) {
          const vaccSnap = await db
            .collection(`families/${familyId}/pets/${petId}/vaccines`)
            .where('reminderEnabled', '==', true)
            .get();

          for (const vDoc of vaccSnap.docs) {
            const v = vDoc.data();
            if (!v.nextDueDate || v.reminderDaysBeforeDue == null) continue;
            const daysLeft = daysUntilTimestamp(v.nextDueDate as Timestamp);
            if (daysLeft !== null && daysLeft <= (v.reminderDaysBeforeDue as number) && daysLeft >= 0) {
              await sendToTokens(tokens, {
                title: `💉 ${petName}`,
                body: `חיסון "${v.name as string}" בעוד ${daysLeft} ימים`,
                data: { route: `/pet/${petId}/vaccines` },
              });
            }
          }
        }

        // ── Treatments due soon ───────────────────────────────────────
        if (prefs.treatments !== false) {
          const treatSnap = await db
            .collection(`families/${familyId}/pets/${petId}/treatments`)
            .where('reminderEnabled', '==', true)
            .get();

          for (const trDoc of treatSnap.docs) {
            const tr = trDoc.data();
            if (!tr.nextDueDate || tr.reminderDaysBeforeDue == null) continue;
            const daysLeft = daysUntilTimestamp(tr.nextDueDate as Timestamp);
            if (daysLeft !== null && daysLeft <= (tr.reminderDaysBeforeDue as number) && daysLeft >= 0) {
              await sendToTokens(tokens, {
                title: `🐛 ${petName}`,
                body: `טיפול "${tr.productName as string}" בעוד ${daysLeft} ימים`,
                data: { route: `/pet/${petId}/treatments` },
              });
            }
          }
        }

        // ── Appointments tomorrow ─────────────────────────────────────
        if (prefs.appointments !== false) {
          const tomorrowStart = new Date();
          tomorrowStart.setDate(tomorrowStart.getDate() + 1);
          tomorrowStart.setHours(0, 0, 0, 0);
          const tomorrowEnd = new Date(tomorrowStart);
          tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

          const aptSnap = await db
            .collection(`families/${familyId}/pets/${petId}/appointments`)
            .where('status', '==', 'scheduled')
            .where('reminderEnabled', '==', true)
            .where('scheduledDate', '>=', Timestamp.fromDate(tomorrowStart))
            .where('scheduledDate', '<', Timestamp.fromDate(tomorrowEnd))
            .get();

          for (const aptDoc of aptSnap.docs) {
            const apt = aptDoc.data();
            await sendToTokens(tokens, {
              title: `📅 ${petName}`,
              body: `תור מחר: ${apt.title as string}`,
              data: { route: `/pet/${petId}/appointments` },
            });
          }
        }
      }
    }
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isQuietHour(quietStart: string, quietEnd: string): boolean {
  const now = new Date();
  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  // Period may wrap midnight (e.g. 22:00–08:00)
  if (startMins > endMins) {
    return nowMins >= startMins || nowMins < endMins;
  }
  return nowMins >= startMins && nowMins < endMins;
}

function daysUntilTimestamp(ts: Timestamp): number {
  const d = ts.toDate();
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function sendToTokens(
  tokens: string[],
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  if (tokens.length === 0) return;
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: notification.title, body: notification.body },
    data: notification.data ?? {},
    android: {
      priority: 'high',
      notification: { channelId: 'reminders', sound: 'default' },
    },
  };
  const response = await admin.messaging().sendEachForMulticast(message);
  response.responses.forEach((r, i) => {
    if (!r.success) {
      console.error(`FCM token[${i}] failed: ${r.error?.message}`);
    }
  });
}
