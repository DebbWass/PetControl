import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { arrayUnion, updateDoc, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase/config';
import { paths } from './firebase/firestore';
import { Medication } from '../types';

/** Storage key: JSON object mapping medicationId → scheduled notification IDs */
const MED_NOTIF_MAP_KEY = '@petcontrol:med_notif_map';

type MedNotifMap = Record<string, string[]>;

async function getMedNotifMap(): Promise<MedNotifMap> {
  try {
    const raw = await AsyncStorage.getItem(MED_NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveMedNotifMap(map: MedNotifMap): Promise<void> {
  await AsyncStorage.setItem(MED_NOTIF_MAP_KEY, JSON.stringify(map));
}

async function scheduleTimesForMed(
  med: Medication,
  times: string[],
  petName: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const timeStr of times) {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10) || 8;
    const minute = parseInt(minuteStr, 10) || 0;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          // Title = who; body = what + how much (matches cloud function pattern)
          title: `💊 ${petName}`,
          body: `${med.name} – ${med.dosage}`,
          data: {
            medicationId: med.id,
            petId: med.petId,
            route: `/pet/${med.petId}/medications`,
          },
          sound: true,
        },
        identifier: `med_${med.id}_${hour}_${minute}`,
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      ids.push(id);
    } catch { /* skip individual failure */ }
  }
  return ids;
}

/** Set up Android notification channels. Call once at app boot. */
export async function setupNotificationChannels(): Promise<void> {
  await Notifications.setNotificationChannelAsync('medications', {
    name: 'תרופות',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4CAF50',
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'תזכורות',
    importance: AndroidImportance.DEFAULT,
  });
}

/**
 * Request push notification permission and return the raw FCM device token.
 * Returns null if running in simulator or permission denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data as string;
}

/** Save FCM token to the user's member document using arrayUnion (no duplicates). */
export async function saveTokenToFirestore(
  uid: string,
  familyId: string,
  token: string
): Promise<void> {
  const memberRef = doc(db, paths.members(familyId), uid);
  await updateDoc(memberRef, { fcmTokens: arrayUnion(token) });
}

/**
 * Schedule (or reschedule) daily local notifications for a single medication.
 * Supports both single `reminderTime` and multi-dose `reminderTimes[]`.
 * Cancels any previously scheduled notifications for this medication first.
 * @param petName Display name of the pet — shown as the notification title.
 */
export async function scheduleOneMedicationReminder(
  med: Medication,
  petName: string
): Promise<void> {
  const map = await getMedNotifMap();

  // Cancel existing notifications for this medication
  const oldIds = map[med.id] ?? [];
  await Promise.all(
    oldIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );

  if (!med.isActive || !med.reminderEnabled || med.frequencyUnit === 'as_needed') {
    delete map[med.id];
    await saveMedNotifMap(map);
    return;
  }

  // Multi-dose: use reminderTimes[]; single-dose: use reminderTime
  const times =
    med.reminderTimes && med.reminderTimes.length > 0
      ? med.reminderTimes
      : [med.reminderTime ?? '08:00'];

  const newIds = await scheduleTimesForMed(med, times, petName);
  if (newIds.length > 0) {
    map[med.id] = newIds;
  } else {
    delete map[med.id];
  }
  await saveMedNotifMap(map);
}

/**
 * Cancel all local notifications for a medication (call when medication is deleted).
 */
export async function cancelMedicationReminder(medId: string): Promise<void> {
  const map = await getMedNotifMap();
  const ids = map[medId] ?? [];
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
  delete map[medId];
  await saveMedNotifMap(map);
}

/**
 * Cancel ALL scheduled medication reminders and reschedule them all from scratch.
 * Call at app boot to ensure every active medication has a live local notification.
 * Supports both single `reminderTime` and multi-dose `reminderTimes[]`.
 * @param petsMap Record mapping petId → pet display name for notification titles.
 */
export async function scheduleLocalMedicationReminders(
  medications: Medication[],
  petsMap: Record<string, string> = {}
): Promise<void> {
  const map = await getMedNotifMap();

  // Cancel everything currently scheduled
  const allIds = Object.values(map).flat();
  await Promise.all(
    allIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );

  const newMap: MedNotifMap = {};

  const active = medications.filter(
    (m) => m.isActive && m.reminderEnabled && m.frequencyUnit !== 'as_needed'
  );

  for (const med of active) {
    const petName = petsMap[med.petId] ?? '';
    const times =
      med.reminderTimes && med.reminderTimes.length > 0
        ? med.reminderTimes
        : [med.reminderTime ?? '08:00'];

    const ids = await scheduleTimesForMed(med, times, petName);
    if (ids.length > 0) {
      newMap[med.id] = ids;
    }
  }

  await saveMedNotifMap(newMap);
}
