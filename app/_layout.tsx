import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { onAuthChange } from '../src/services/firebase/auth';
import { loadUserProfile } from '../src/services/firebase/auth';
import { useAuthStore } from '../src/store/authStore';
import { usePetsSubscription } from '../src/hooks/usePets';
import { initI18n } from '../src/i18n';
import { Colors } from '../src/constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

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
