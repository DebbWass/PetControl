import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Divider, Chip, FAB, IconButton } from 'react-native-paper';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePet } from '../../src/hooks/usePets';
import { softDeletePet } from '../../src/services/firebase/firestore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';
import { formatAge } from '../../src/utils/dateUtils';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const pet = usePet(id);
  const isHe = i18n.language === 'he';

  if (!pet) {
    return (
      <View style={styles.center}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  const speciesInfo = SPECIES_MAP[pet.species];

  function confirmDelete() {
    Alert.alert(
      t('pets.deletePet'),
      t('pets.confirmDelete', { name: pet!.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await softDeletePet(user!.familyId, id);
            router.back();
          },
        },
      ]
    );
  }

  const sections = [
    { icon: 'scale', label: t('weight.title'), route: `/pet/${id}/weight` },
    { icon: 'pill', label: t('medications.title'), route: `/pet/${id}/medications` },
    { icon: 'needle', label: t('vaccines.title'), route: `/pet/${id}/vaccines` },
    { icon: 'bug', label: t('treatments.title'), route: `/pet/${id}/treatments` },
    { icon: 'calendar-clock', label: t('appointments.title'), route: `/pet/${id}/appointments` },
    { icon: 'food', label: t('food.title'), route: `/pet/${id}/food` },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: pet.name,
          headerRight: () => (
            <IconButton icon="delete" iconColor={Colors.danger} onPress={confirmDelete} />
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header card */}
        <Card style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <Text style={styles.petEmoji}>{speciesInfo?.emoji ?? '🐾'}</Text>
            <Text variant="headlineMedium">{pet.name}</Text>
            <Text variant="bodyMedium" style={styles.speciesText}>
              {isHe ? speciesInfo?.labelHe : speciesInfo?.labelEn}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </Text>
            <View style={styles.chips}>
              <Chip compact style={styles.chip}>
                {pet.sex === 'male' ? t('pets.male') : pet.sex === 'female' ? t('pets.female') : t('pets.unknown')}
              </Chip>
              {pet.birthdate && (
                <Chip compact style={styles.chip}>{formatAge(pet.birthdate)}</Chip>
              )}
              {pet.isNeutered && (
                <Chip compact style={styles.chip}>{t('pets.isNeutered')}</Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Sections */}
        {sections.map((section) => (
          <Card
            key={section.route}
            style={styles.sectionCard}
            onPress={() => router.push(section.route as any)}
          >
            <Card.Title
              title={section.label}
              left={(props) => (
                <Card.Cover
                  {...(props as any)}
                  style={{ display: 'none' }}
                />
              )}
              right={(props) => (
                <IconButton {...props} icon="chevron-right" />
              )}
            />
          </Card>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { marginBottom: 16 },
  headerContent: { alignItems: 'center', paddingVertical: 16 },
  petEmoji: { fontSize: 64, marginBottom: 8 },
  speciesText: { color: Colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 },
  chip: { backgroundColor: Colors.primaryLight },
  sectionCard: { marginBottom: 8 },
});
