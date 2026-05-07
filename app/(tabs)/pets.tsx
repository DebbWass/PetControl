import { useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, FAB, Avatar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect } from 'expo-router';
import { usePets } from '../../src/hooks/usePets';
import { getPets } from '../../src/services/firebase/firestore';
import { usePetsStore } from '../../src/store/petsStore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';
import { Pet } from '../../src/types';

function PetAvatar({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const { i18n } = useTranslation();
  const speciesInfo = SPECIES_MAP[pet.species];

  return (
    <Pressable style={styles.petItem} onPress={onPress}>
      <View style={styles.avatarCircle}>
        {pet.photoUrl ? (
          <Avatar.Image size={80} source={{ uri: pet.photoUrl }} />
        ) : (
          <Avatar.Text size={80} label={speciesInfo?.emoji ?? '🐾'} style={styles.avatarText} />
        )}
      </View>
      <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
    </Pressable>
  );
}

export default function PetsScreen() {
  const { t } = useTranslation();
  const pets = usePets();
  const setPets = usePetsStore((s) => s.setPets);
  const familyId = useAuthStore((s) => s.user?.familyId);

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
        numColumns={3}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <Text variant="headlineMedium" style={styles.title}>
            {t('pets.title')}
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{t('pets.noPets')}</Text>
        }
        renderItem={({ item }) => (
          <PetAvatar
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
  title: { marginBottom: 20 },
  row: { justifyContent: 'space-around', marginBottom: 20 },
  petItem: { alignItems: 'center', flex: 1, maxWidth: '33%' },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { backgroundColor: Colors.primaryLight },
  petName: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    color: Colors.textPrimary,
    maxWidth: 90,
  },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
});
