import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, List, Divider, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { useDashboard, DashboardTask } from '../../src/hooks/useDashboard';
import { Colors } from '../../src/constants/colors';

function iconForType(type: DashboardTask['type']): string {
  const icons: Record<DashboardTask['type'], string> = {
    medication: 'pill',
    vaccine: 'needle',
    treatment: 'bug',
    appointment: 'calendar-clock',
  };
  return icons[type];
}

export default function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'he' ? heLocale : enUS;
  const { today, upcoming7, overdue, isLoading } = useDashboard();

  const isEmpty = !isLoading && today.length === 0 && upcoming7.length === 0 && overdue.length === 0;

  function renderTask(task: DashboardTask) {
    const key = `${task.petId}-${task.type}-${task.scheduledDate.getTime()}`;
    return (
      <List.Item
        key={key}
        title={`${task.petName} – ${task.label}`}
        description={format(task.scheduledDate, 'dd/MM/yyyy', { locale })}
        left={(props) => <List.Icon {...props} icon={iconForType(task.type)} />}
        onPress={() => router.push(task.route as any)}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
      />
    );
  }

  const sections: { title: string; tasks: DashboardTask[]; color: string }[] = [
    { title: t('reminders.overdue'), tasks: overdue, color: Colors.danger },
    { title: t('reminders.today'), tasks: today, color: Colors.primary },
    { title: t('reminders.upcoming'), tasks: upcoming7, color: Colors.info },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>{t('reminders.title')}</Text>

      {isLoading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

      {sections.map((section) =>
        section.tasks.length > 0 ? (
          <View key={section.title}>
            <List.Subheader style={[styles.subheader, { color: section.color }]}>
              {section.title}
            </List.Subheader>
            {section.tasks.map(renderTask)}
            <Divider />
          </View>
        ) : null
      )}

      {isEmpty && (
        <Text style={styles.empty}>{t('reminders.noReminders')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  title: { padding: 16, paddingBottom: 8 },
  loader: { marginTop: 40 },
  subheader: { fontWeight: '600' },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 60, fontSize: 16 },
});
