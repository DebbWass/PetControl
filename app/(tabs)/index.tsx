import { ScrollView, StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, List } from 'react-native-paper';
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

    let desc: string;
    if (task.daysUntil === 0) {
      desc = task.timeLabel
        ? t('reminders.todayAt', { time: task.timeLabel })
        : t('reminders.todayLabel');
    } else if (task.daysUntil < 0) {
      desc = task.timeLabel
        ? `${t('reminders.overdue')} • ${task.timeLabel}`
        : t('reminders.overdue');
    } else {
      desc = task.timeLabel
        ? `${t('reminders.daysLeft', { count: task.daysUntil })} • ${task.timeLabel}`
        : t('reminders.daysLeft', { count: task.daysUntil });
    }

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

      {/* Pet quick-access grid */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {t('tabs.pets')} ({pets.length})
      </Text>
      {pets.length === 0 ? (
        <Text style={styles.muted}>{t('pets.noPets')}</Text>
      ) : (
        <View style={styles.petGrid}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={styles.petItem}
              onPress={() => router.push(`/pet/${pet.id}` as any)}
            >
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={styles.petCircle} />
              ) : (
                <View style={[styles.petCircle, styles.petCircleFallback]}>
                  <Text style={styles.petEmoji}>
                    {SPECIES_MAP[pet.species]?.emoji ?? '🐾'}
                  </Text>
                </View>
              )}
              <Text style={styles.petName} numberOfLines={1}>
                {pet.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  taskTitle: { fontSize: 14 },
  petGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  petItem: { width: '33.33%', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  petCircle: { width: 70, height: 70, borderRadius: 35 },
  petCircleFallback: { backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  petEmoji: { fontSize: 32 },
  petName: { fontSize: 12, marginTop: 6, textAlign: 'center', color: Colors.textPrimary },
});
