import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { onAuthChange } from '../src/services/firebase/auth';
import { loadUserProfile } from '../src/services/firebase/auth';
import { useAuthStore } from '../src/store/authStore';
import { usePetsSubscription } from '../src/hooks/usePets';
import { initI18n } from '../src/i18n';
import { Colors } from '../src/constants/colors';
import {
  registerForPushNotifications,
  saveTokenToFirestore,
  setupNotificationChannels,
} from '../src/services/notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

// Configure notification handler (must be set before any notification is received)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.secondary,
  },
};

function AuthListener() {
  const { setUser, setLoading, clear } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await loadUserProfile(firebaseUser);
          setUser(appUser);
          setLoading(false);
          router.replace('/(tabs)/');
        } catch {
          clear();
          router.replace('/auth/login');
        }
      } else {
        clear();
        router.replace('/auth/login');
      }
    });
    return unsubscribe;
  }, []);

  return null;
}

function PetsLoader() {
  usePetsSubscription();
  return null;
}

function NotificationBootstrapper() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setupNotificationChannels();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Register device token and save to Firestore
    registerForPushNotifications().then((token) => {
      if (token) {
        saveTokenToFirestore(user.uid, user.familyId, token).catch(() => {
          // Non-fatal: token will be registered on next launch
        });
      }
    });

    // Deep-link handler: open screen when user taps a notification
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route as string | undefined;
      if (route) router.push(route as any);
    });

    return () => sub.remove();
  }, [user?.uid]);

  return null;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={theme}>
        <AuthListener />
        <PetsLoader />
        <NotificationBootstrapper />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="pet" />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
