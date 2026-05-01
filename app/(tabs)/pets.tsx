import { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, FAB, Card, Avatar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect } from 'expo-router';
import { usePets } from '../../src/hooks/usePets';
import { getPets } from '../../src/services/firebase/firestore';
import { usePetsStore } from '../../src/store/petsStore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';
import { Pet } from '../../src/types';
import { formatAge } from '../../src/utils/dateUtils';

function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const speciesInfo = SPECIES_MAP[pet.species];
  const isHe = i18n.language === 'he';

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={pet.name}
        subtitle={`${isHe ? speciesInfo?.labelHe : speciesInfo?.labelEn}${pet.breed ? ` · ${pet.breed}` : ''}`}
        left={(props) =>
          pet.photoUrl ? (
            <Avatar.Image {...props} source={{ uri: pet.photoUrl }} />
          ) : (
            <Avatar.Text {...props} label={speciesInfo?.emoji ?? '🐾'} />
          )
        }
        right={() =>
          pet.birthdate ? (
            <Text style={styles.ageText}>{formatAge(pet.birthdate)}</Text>
          ) : null
        }
      />
    </Card>
  );
}

export default function PetsScreen() {
  const { t } = useTranslation();
  const pets = usePets();
  const setPets = usePetsStore((s) => s.setPets);
  const familyId = useAuthStore((s) => s.user?.familyId);

  // Refresh the pets list every time this tab comes into focus.
  // This ensures a newly-added pet is visible even if the real-time
  // subscription hadn't fired yet (e.g. missing index, slow connection).
  useFocusEffect(
    useCallback(() => {
      if (!familyId) return;
      getPets(familyId).then(setPets).catch(console.error);
    }, [familyId])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text variant="headlineMedium" style={styles.title}>
            {t('pets.title')}
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{t('pets.noPets')}</Text>
        }
        renderItem={({ item }) => (
          <PetCard
            pet={item}
            onPress={() => router.push(`/pet/${item.id}`)}
          />
        )}
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/pet/new')}
        label={t('pets.addPet')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 100 },
  title: { marginBottom: 16 },
  card: { marginBottom: 12 },
  ageText: { marginRight: 16, color: Colors.textSecondary, fontSize: 13 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
});
