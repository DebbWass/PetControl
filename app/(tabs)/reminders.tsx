import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';

export default function RemindersScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        {t('reminders.title')}
      </Text>
      <Text style={styles.muted}>{t('reminders.noReminders')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { marginBottom: 16, marginTop: 8 },
  muted: { color: Colors.textSecondary },
});
