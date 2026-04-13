import { View, StyleSheet } from 'react-native';
import { Text, List, Switch, Divider, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { setLanguage } from '../../src/i18n';
import { logout } from '../../src/services/firebase/auth';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const family = useAuthStore((s) => s.family);
  const [isHebrew, setIsHebrew] = useState(i18n.language === 'he');

  async function handleLanguageToggle(val: boolean) {
    setIsHebrew(val);
    await setLanguage(val ? 'he' : 'en');
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        {t('settings.title')}
      </Text>

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
