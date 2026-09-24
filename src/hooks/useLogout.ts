import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { logout } from '../services/firebase/auth';
import { clearDeviceNotifications } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { usePetsStore } from '../store/petsStore';

/** Returns a handler that asks for confirmation, signs out and returns to the login screen. */
export function useLogout() {
  const { t } = useTranslation();

  async function performLogout() {
    const { user, clear } = useAuthStore.getState();
    try {
      if (user) await clearDeviceNotifications(user.uid, user.familyId);
      await logout();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message);
      return;
    }
    // AuthListener also reacts to the sign-out; clearing here avoids a frame
    // of stale data and makes the redirect independent of listener timing.
    clear();
    usePetsStore.getState().setPets([]);
    router.replace('/auth/login');
  }

  return function confirmLogout() {
    Alert.alert(
      t('auth.logoutConfirmTitle'),
      t('auth.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: performLogout },
      ]
    );
  };
}
