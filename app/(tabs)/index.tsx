import { ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, List } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePets } from '../../src/hooks/usePets';
import { useAuthStore } from '../../src/store/authStore';
import { useDashboard, DashboardTask } from '../../src/hooks/useDashboard';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';

function taskTypeIcon(type: DashboardTask['type']): string {
  const icons: Record<DashboardTask['type'], string> = {
    medication: '💊',
    vaccine: '💉',
    treatment: '🐛',
    appointment: '📅',
  };
  return icons[type];
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const pets = usePets();
  const { today, upcoming7, overdue, isLoading } = useDashboard();

  function renderTask(task: DashboardTask) {
    const key = `${task.petId}-${task.type}-${task.scheduledDate.getTime()}`;
    const desc =
      task.daysUntil === 0
        ? t('reminders.todayLabel')
        : task.daysUntil < 0
        ? t('reminders.overdue')
        : t('reminders.daysLeft', { count: task.daysUntil });

    return (
      <List.Item
        key={key}
        title={`${taskTypeIcon(task.type)} ${task.petName} – ${task.label}`}
        description={desc}
        onPress={() => router.push(task.route as any)}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        titleStyle={styles.taskTitle}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        {t('dashboard.title')} {user?.displayName} 👋
      </Text>

      {/* Overdue tasks */}
      {overdue.length > 0 && (
        <Card style={[styles.card, styles.overdueCard]}>
          <Card.Title
            title={t('reminders.overdue')}
            left={(props) => <List.Icon {...props} icon="alert-circle" color={Colors.danger} />}
          />
          <Card.Content>{overdue.map(renderTask)}</Card.Content>
        </Card>
      )}

      {/* Today's tasks */}
      <Card style={styles.card}>
        <Card.Title title={t('dashboard.todayTasks')} />
        <Card.Content>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : today.length === 0 ? (
            <Text style={styles.muted}>{t('dashboard.noTasksToday')}</Text>
          ) : (
            today.map(renderTask)
          )}
        </Card.Content>
      </Card>

      {/* Upcoming 7 days */}
      {upcoming7.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title={t('dashboard.upcoming7')} />
          <Card.Content>{upcoming7.map(renderTask)}</Card.Content>
        </Card>
      )}

      {/* Pet quick-access strip */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {t('tabs.pets')} ({pets.length})
      </Text>
      {pets.length === 0 ? (
        <Text style={styles.muted}>{t('pets.noPets')}</Text>
      ) : (
        pets.slice(0, 6).map((pet) => (
          <Chip
            key={pet.id}
            style={styles.petChip}
            icon={() => <Text>{SPECIES_MAP[pet.species]?.emoji ?? '🐾'}</Text>}
            onPress={() => router.push(`/pet/${pet.id}` as any)}
          >
            {pet.name}
          </Chip>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { marginBottom: 16, marginTop: 8 },
  card: { marginBottom: 12 },
  overdueCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  loader: { marginVertical: 12 },
  sectionTitle: { marginBottom: 8, marginTop: 4 },
  muted: { color: Colors.textSecondary, marginTop: 4, marginBottom: 8 },
  petChip: { marginBottom: 6, alignSelf: 'flex-start' },
  taskTitle: { fontSize: 14 },
});
