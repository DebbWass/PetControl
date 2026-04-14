import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { arrayUnion, updateDoc, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase/config';
import { paths } from './firebase/firestore';
import { Medication } from '../types';

const SCHEDULED_MED_IDS_KEY = '@petcontrol:scheduled_med_ids';

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
    // Simulators cannot receive push notifications
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

/** Cancel all previously scheduled local medication reminders and reschedule them. */
export async function scheduleLocalMedicationReminders(
  medications: Medication[]
): Promise<void> {
  // Cancel existing scheduled notifications
  const savedRaw = await AsyncStorage.getItem(SCHEDULED_MED_IDS_KEY);
  const savedIds: string[] = savedRaw ? JSON.parse(savedRaw) : [];
  await Promise.all(savedIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const newIds: string[] = [];

  const active = medications.filter(
    (m) => m.isActive && m.reminderEnabled && m.frequencyUnit !== 'as_needed'
  );

  for (const med of active) {
    const timeStr = med.reminderTime ?? '08:00';
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10) || 8;
    const minute = parseInt(minuteStr, 10) || 0;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${med.name}`,
        body: med.dosage,
        data: { medicationId: med.id, petId: med.petId },
        sound: true,
      },
      identifier: `med_${med.id}`,
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    newIds.push(id);
  }

  await AsyncStorage.setItem(SCHEDULED_MED_IDS_KEY, JSON.stringify(newIds));
}
