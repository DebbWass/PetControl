import { View, StyleSheet, Alert } from 'react-native';
import { Text, List, Switch, Divider, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import * as Updates from 'expo-updates';
import { setLanguage } from '../../src/i18n';
import { logout } from '../../src/services/firebase/auth';
import { useAuthStore } from '../../src/store/authStore';
import { updateRecord } from '../../src/services/firebase/firestore';
import { paths } from '../../src/services/firebase/firestore';
import { Colors } from '../../src/constants/colors';
import { AppUser, NotificationPrefs } from '../../src/types';

const DEFAULT_PREFS: NotificationPrefs = {
  medications: true,
  vaccines: true,
  treatments: true,
  appointments: true,
  quietStart: '22:00',
  quietEnd: '08:00',
};

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const family = useAuthStore((s) => s.family);
  const [isHebrew, setIsHebrew] = useState(i18n.language === 'he');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(
    user?.notificationPrefs ?? DEFAULT_PREFS
  );

  async function handleLanguageToggle(val: boolean) {
    await setLanguage(val ? 'he' : 'en');
    Alert.alert(
      t('settings.restartRequired'),
      t('settings.restartMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => {
            // Revert to current language if user cancels
            setIsHebrew(!val);
          },
        },
        {
          text: t('settings.restart'),
          onPress: async () => {
            setIsHebrew(val);
            try {
              await Updates.reloadAsync();
            } catch {
              // In Expo Go / development, reloadAsync may not work — ignore
            }
          },
        },
      ]
    );
  }

  async function handlePrefToggle(key: 'medications' | 'vaccines' | 'treatments' | 'appointments') {
    if (!user) return;
    const updated: NotificationPrefs = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    await updateRecord<AppUser>(
      paths.members(user.familyId),
      user.uid,
      { notificationPrefs: updated } as Partial<AppUser>
    );
  }

  const notifItems: { key: 'medications' | 'vaccines' | 'treatments' | 'appointments'; labelKey: string }[] = [
    { key: 'medications', labelKey: 'settings.medications_notif' },
    { key: 'vaccines', labelKey: 'settings.vaccines_notif' },
    { key: 'treatments', labelKey: 'settings.treatments_notif' },
    { key: 'appointments', labelKey: 'settings.appointments_notif' },
  ];

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        {t('settings.title')}
      </Text>

      {/* Language */}
      <List.Section>
        <List.Subheader>{t('settings.language')}</List.Subheader>
        <List.Item
          title={t('settings.hebrew')}
          right={() => (
            <Switch value={isHebrew} onValueChange={handleLanguageToggle} color={Colors.primary} />
          )}
        />
      </List.Section>

      <Divider />

      {/* Notification preferences */}
      <List.Section>
        <List.Subheader>{t('settings.notifications')}</List.Subheader>
        {notifItems.map(({ key, labelKey }) => (
          <List.Item
            key={key}
            title={t(labelKey)}
            right={() => (
              <Switch
                value={!!notifPrefs[key]}
                onValueChange={() => handlePrefToggle(key)}
                color={Colors.primary}
              />
            )}
          />
        ))}
      </List.Section>

      <Divider />

      {/* Family */}
      <List.Section>
        <List.Subheader>{t('settings.family')}</List.Subheader>
        {user?.familyId && (
          <List.Item
            title={t('settings.inviteCode')}
            description={family?.inviteCode ?? '------'}
            left={(props) => <List.Icon {...props} icon="qrcode" />}
          />
        )}
      </List.Section>

      <Divider />

      <View style={styles.logoutContainer}>
        <Button
          mode="outlined"
          onPress={logout}
          textColor={Colors.danger}
          style={styles.logoutButton}
        >
          {t('auth.logout')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { padding: 16, paddingBottom: 8 },
  logoutContainer: { padding: 16, marginTop: 16 },
  logoutButton: { borderColor: Colors.danger },
});
