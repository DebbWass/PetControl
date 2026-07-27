import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText, SegmentedButtons } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import {
  registerAndCreateFamily,
  registerAndJoinFamily,
} from '../../src/services/firebase/auth';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';

type Mode = 'create' | 'join';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!email || !password || !displayName) {
      setError(t('common.required'));
      return;
    }
    if (mode === 'create' && !familyName) {
      setError(t('common.required'));
      return;
    }
    if (mode === 'join' && !inviteCode) {
      setError(t('common.required'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user =
        mode === 'create'
          ? await registerAndCreateFamily(email.trim(), password, displayName.trim(), familyName.trim())
          : await registerAndJoinFamily(email.trim(), password, displayName.trim(), inviteCode.trim());
      setUser(user);
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e.message === 'INVALID_INVITE_CODE') {
        setError(t('family.invalidCode'));
      } else {
        setError(e.message ?? t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>{t('auth.register')}</Text>

        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'create', label: t('family.create') },
            { value: 'join', label: t('family.join') },
          ]}
          style={styles.segment}
        />

        <TextInput
          label={t('auth.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
          mode="outlined"
        />
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
          secureTextEntry
          style={styles.input}
          mode="outlined"
        />

        {mode === 'create' ? (
          <TextInput
            label={t('family.familyName')}
            value={familyName}
            onChangeText={setFamilyName}
            style={styles.input}
            mode="outlined"
          />
        ) : (
          <TextInput
            label={t('family.inviteCode')}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder={t('family.inviteCodePlaceholder')}
            style={styles.input}
            mode="outlined"
          />
        )}

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          style={styles.button}
          buttonColor={Colors.primary}
        >
          {mode === 'create' ? t('family.createButton') : t('family.joinButton')}
        </Button>

        <Button mode="text" onPress={() => router.back()} style={styles.linkButton}>
          {t('auth.hasAccount')} {t('auth.loginButton')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, backgroundColor: Colors.background },
  title: { marginBottom: 16, textAlign: 'center' },
  segment: { marginBottom: 20 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 8 },
  linkButton: { marginTop: 8 },
});
