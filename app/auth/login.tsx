import { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { Text, TextInput, Button, HelperText, Checkbox } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { loginUser, sendPasswordReset } from '../../src/services/firebase/auth';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';

const CREDENTIALS_KEY = '@petcontrol_credentials';

export default function LoginScreen() {
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email on mount. We intentionally never persist the password —
  // the signed-in session itself is kept by Firebase Auth persistence, and
  // "Remember me" only pre-fills the email address for convenience.
  useEffect(() => {
    AsyncStorage.getItem(CREDENTIALS_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved?.remember) {
          setEmail(saved.email ?? '');
          setRememberMe(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      setError(t('common.required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await loginUser(email.trim(), password);
      setUser(user);

      // Persist only the email address (never the password).
      if (rememberMe) {
        await AsyncStorage.setItem(
          CREDENTIALS_KEY,
          JSON.stringify({ email: email.trim(), remember: true })
        );
      } else {
        await AsyncStorage.removeItem(CREDENTIALS_KEY);
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const target = email.trim();
    if (!target) {
      setError(t('auth.enterEmailFirst'));
      return;
    }
    setError('');
    try {
      await sendPasswordReset(target);
    } catch (e: any) {
      // Don't reveal whether an account exists for this email — only surface
      // genuine failures (network, malformed address, etc.).
      if (e?.code && e.code !== 'auth/user-not-found') {
        setError(e.message ?? t('common.error'));
        return;
      }
    }
    Alert.alert(t('auth.resetSentTitle'), t('auth.resetSentBody'));
  }

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 600;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.container, isWideScreen && styles.containerWide]}>
        <Text variant="displaySmall" style={styles.logo}>🐾</Text>
        <Text variant="headlineMedium" style={styles.title}>
          {t('app.name')}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t('app.tagline')}
        </Text>

        <TextInput
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={styles.input}
          mode="outlined"
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((v) => !v)}
            />
          }
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        {/* Remember Me */}
        <View style={styles.rememberRow}>
          <Checkbox
            status={rememberMe ? 'checked' : 'unchecked'}
            onPress={() => setRememberMe((v) => !v)}
            color={Colors.primary}
          />
          <Text
            variant="bodyMedium"
            style={styles.rememberLabel}
            onPress={() => setRememberMe((v) => !v)}
          >
            {t('auth.rememberMe')}
          </Text>
        </View>

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          style={styles.button}
          buttonColor={Colors.primary}
        >
          {t('auth.loginButton')}
        </Button>

        <Button
          mode="text"
          onPress={handleForgotPassword}
          disabled={loading}
          style={styles.linkButton}
          textColor={Colors.textSecondary}
        >
          {t('auth.forgotPassword')}
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/auth/register')}
          style={styles.linkButton}
        >
          {t('auth.noAccount')} {t('auth.registerButton')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  containerWide: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
  logo: { textAlign: 'center', marginBottom: 8 },
  title: { textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: Colors.textSecondary, marginBottom: 32 },
  input: { marginBottom: 12 },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rememberLabel: {
    color: Colors.textSecondary,
  },
  button: { marginTop: 8, borderRadius: 8 },
  linkButton: { marginTop: 8 },
});
