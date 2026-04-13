import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePets } from '../../src/hooks/usePets';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';

export default function HomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const pets = usePets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>
        {t('dashboard.title')} {user?.displayName} 👋
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{t('dashboard.todayTasks')}</Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {t('dashboard.noTasksToday')}
          </Text>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        {t('tabs.pets')} ({pets.length})
      </Text>

      {pets.length === 0 ? (
        <Text style={styles.muted}>{t('pets.noPets')}</Text>
      ) : (
        pets.slice(0, 5).map((pet) => (
          <Chip
            key={pet.id}
            style={styles.petChip}
            icon={() => (
              <Text>{SPECIES_MAP[pet.species]?.emoji ?? '🐾'}</Text>
            )}
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
  content: { padding: 16 },
  title: { marginBottom: 16, marginTop: 8 },
  card: { marginBottom: 16 },
  sectionTitle: { marginBottom: 8, marginTop: 8 },
  muted: { color: Colors.textSecondary, marginTop: 4 },
  petChip: { marginBottom: 6, alignSelf: 'flex-start' },
});
