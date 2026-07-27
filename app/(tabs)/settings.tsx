import { View, StyleSheet, Alert, Share } from 'react-native';
import { Text, List, Switch, Divider, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import * as Updates from 'expo-updates';
import { setLanguage } from '../../src/i18n';
import { logout, deleteAccount } from '../../src/services/firebase/auth';
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
  const [deleting, setDeleting] = useState(false);

  // Whether this user is the sole remaining family member. If so, deleting the
  // account wipes all family data; otherwise the user just leaves the family.
  const isLastMember = (family?.memberUids?.length ?? 1) <= 1;

  function handleDeleteAccount() {
    Alert.alert(
      t('settings.deleteAccount'),
      isLastMember
        ? t('settings.deleteAccountWarnOwnerLast')
        : t('settings.deleteAccountWarnMember'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  }

  function confirmDeleteAccount() {
    Alert.alert(
      t('settings.deleteAccountFinalTitle'),
      t('settings.deleteAccountFinalBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccountConfirmButton'),
          style: 'destructive',
          onPress: doDeleteAccount,
        },
      ]
    );
  }

  async function doDeleteAccount() {
    setDeleting(true);
    try {
      // On success the auth listener signs the user out and routes to login.
      await deleteAccount();
    } catch (e: any) {
      setDeleting(false);
      Alert.alert(t('common.error'), e?.message ?? t('settings.deleteAccountError'));
    }
  }

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

  async function handleShareCode() {
    const code = family?.inviteCode;
    if (!code) return;
    try {
      await Share.share({
        message: i18n.language === 'he'
          ? `הצטרף למשפחה שלי ב-PetControl! קוד הזמנה: ${code}`
          : `Join my family on PetControl! Invite code: ${code}`,
      });
    } catch {
      // user cancelled share
    }
  }

  const notifItems: { key: 'medications' | 'vaccines' | 'treatments' | 'appointments'; labelKey: string }[] = [
    { key: 'medications', labelKey: 'settings.medications_notif' },
    { key: 'vaccines', labelKey: 'settings.vaccines_notif' },
    { key: 'treatments', labelKey: 'settings.treatments_notif' },
    { key: 'appointments', labelKey: 'settings.appointments_notif' },
  ];

  const inviteCode = family?.inviteCode ?? null;

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

      {/* Family & Invite Code */}
      <List.Section>
        <List.Subheader>{t('settings.family')}</List.Subheader>
        {inviteCode ? (
          <>
            <List.Item
              title={t('settings.inviteCode')}
              description={inviteCode}
              left={(props) => <List.Icon {...props} icon="qrcode" />}
            />
            <View style={styles.shareContainer}>
              <Button
                mode="contained"
                icon="share-variant"
                onPress={handleShareCode}
                buttonColor={Colors.primary}
                style={styles.shareButton}
              >
                {t('settings.shareCode')}
              </Button>
            </View>
          </>
        ) : (
          <List.Item
            title={t('settings.inviteCode')}
            description="------"
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
          disabled={deleting}
        >
          {t('auth.logout')}
        </Button>
      </View>

      {/* Danger zone — account deletion */}
      <View style={styles.deleteContainer}>
        <Button
          mode="text"
          onPress={handleDeleteAccount}
          textColor={Colors.danger}
          icon="delete-forever"
          loading={deleting}
          disabled={deleting}
        >
          {t('settings.deleteAccount')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { padding: 16, paddingBottom: 8 },
  shareContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  shareButton: { borderRadius: 8 },
  logoutContainer: { padding: 16, marginTop: 16 },
  logoutButton: { borderColor: Colors.danger },
  deleteContainer: { paddingHorizontal: 16, alignItems: 'center' },
});
