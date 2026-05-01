import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity } from 'react-native';
import {
  Text, Card, Button, Chip, IconButton, Dialog, Portal,
  TextInput, SegmentedButtons, Switch, Menu, HelperText, ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Timestamp } from 'firebase/firestore';
import { usePet } from '../../src/hooks/usePets';
import { softDeletePet, updatePet } from '../../src/services/firebase/firestore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_LIST, SPECIES_MAP } from '../../src/constants/species';
import { Species, Sex, Pet } from '../../src/types';
import { formatAge } from '../../src/utils/dateUtils';
import { uploadPetPhoto } from '../../src/services/storage';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const pet = usePet(id);
  const isHe = i18n.language === 'he';

  // Edit dialog state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSpecies, setEditSpecies] = useState<Species>('cat');
  const [editSex, setEditSex] = useState<Sex>('unknown');
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editBreed, setEditBreed] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editNeutered, setEditNeutered] = useState(false);
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [speciesMenuVisible, setSpeciesMenuVisible] = useState(false);

  if (!pet) {
    return (
      <View style={styles.center}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  const speciesInfo = SPECIES_MAP[pet.species];
  const selectedEditSpecies = SPECIES_LIST.find((s) => s.key === editSpecies);

  function openEdit() {
    setEditName(pet!.name);
    setEditSpecies(pet!.species);
    setEditSex(pet!.sex);
    const year = pet!.birthYear
      ? String(pet!.birthYear)
      : pet!.birthdate
        ? String(pet!.birthdate.toDate().getFullYear())
        : '';
    setEditBirthYear(year);
    setEditBreed(pet!.breed ?? '');
    setEditColor(pet!.color ?? '');
    setEditNeutered(pet!.isNeutered);
    setEditPhotoUri(null);
    setEditError('');
    setEditVisible(true);
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotoUri(result.assets[0].uri);
    }
  }

  async function handleEditSave() {
    if (!editName.trim()) {
      setEditError(t('common.required'));
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const yearNum = parseInt(editBirthYear, 10);
      const hasBirthYear = editBirthYear.trim() && !isNaN(yearNum);

      const updateData: Partial<Pet> = {
        name: editName.trim(),
        species: editSpecies,
        sex: editSex,
        breed: editBreed.trim() || undefined,
        color: editColor.trim() || undefined,
        isNeutered: editNeutered,
        ...(hasBirthYear
          ? {
              birthYear: yearNum,
              birthdate: Timestamp.fromDate(new Date(yearNum, 0, 1)),
            }
          : {}),
      };

      await updatePet(user!.familyId, id, updateData);

      if (editPhotoUri) {
        const photoUrl = await uploadPetPhoto(user!.familyId, id, editPhotoUri);
        await updatePet(user!.familyId, id, { photoUrl });
      }

      setEditVisible(false);
    } catch (e: any) {
      setEditError(e.message ?? t('common.error'));
    } finally {
      setEditLoading(false);
    }
  }

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
    { icon: 'folder-heart', label: t('medicalFile.title'), route: `/pet/${id}/medical-file` },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: pet.name,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton icon="pencil" iconColor={Colors.primary} onPress={openEdit} />
              <IconButton icon="delete" iconColor={Colors.danger} onPress={confirmDelete} />
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header card */}
        <Card style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <TouchableOpacity onPress={openEdit}>
              {editPhotoUri ? (
                <Image source={{ uri: editPhotoUri }} style={styles.petPhoto} />
              ) : pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={styles.petPhoto} />
              ) : (
                <Text style={styles.petEmoji}>{speciesInfo?.emoji ?? '🐾'}</Text>
              )}
            </TouchableOpacity>
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

      {/* Edit Dialog */}
      <Portal>
        <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)} style={styles.editDialog}>
          <Dialog.Title>{t('pets.editPetTitle')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              {/* Photo */}
              <TouchableOpacity onPress={handlePickPhoto} style={styles.photoContainer}>
                {editPhotoUri ? (
                  <Image source={{ uri: editPhotoUri }} style={styles.photoPreview} />
                ) : pet.photoUrl ? (
                  <Image source={{ uri: pet.photoUrl }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoEmoji}>📷</Text>
                  </View>
                )}
                <Text style={styles.photoLabel}>{t('pets.changePhoto')}</Text>
              </TouchableOpacity>

              <TextInput
                label={t('pets.name')}
                value={editName}
                onChangeText={setEditName}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label={`${t('pets.birthYear')} (${t('common.optional')})`}
                value={editBirthYear}
                onChangeText={setEditBirthYear}
                mode="outlined"
                keyboardType="number-pad"
                style={styles.input}
                maxLength={4}
              />

              <Menu
                visible={speciesMenuVisible}
                onDismiss={() => setSpeciesMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setSpeciesMenuVisible(true)}
                    style={styles.menuButton}
                    icon={() => <Text>{selectedEditSpecies?.emoji}</Text>}
                  >
                    {isHe ? selectedEditSpecies?.labelHe : selectedEditSpecies?.labelEn}
                  </Button>
                }
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {SPECIES_LIST.map((s) => (
                    <Menu.Item
                      key={s.key}
                      title={`${s.emoji} ${isHe ? s.labelHe : s.labelEn}`}
                      onPress={() => {
                        setEditSpecies(s.key);
                        setSpeciesMenuVisible(false);
                      }}
                    />
                  ))}
                </ScrollView>
              </Menu>

              <Text variant="labelLarge" style={styles.label}>{t('pets.sex')}</Text>
              <SegmentedButtons
                value={editSex}
                onValueChange={(v) => setEditSex(v as Sex)}
                buttons={[
                  { value: 'male', label: t('pets.male') },
                  { value: 'female', label: t('pets.female') },
                  { value: 'unknown', label: t('pets.unknown') },
                ]}
                style={styles.segment}
              />

              <TextInput
                label={`${t('pets.breed')} (${t('common.optional')})`}
                value={editBreed}
                onChangeText={setEditBreed}
                mode="outlined"
                style={styles.input}
              />

              <TextInput
                label={`${t('pets.color')} (${t('common.optional')})`}
                value={editColor}
                onChangeText={setEditColor}
                mode="outlined"
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <Text variant="bodyLarge">{t('pets.isNeutered')}</Text>
                <Switch
                  value={editNeutered}
                  onValueChange={setEditNeutered}
                  color={Colors.primary}
                />
              </View>

              {editError ? <HelperText type="error">{editError}</HelperText> : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleEditSave} loading={editLoading} textColor={Colors.primary}>
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerButtons: { flexDirection: 'row' },
  headerCard: { marginBottom: 16 },
  headerContent: { alignItems: 'center', paddingVertical: 16 },
  petEmoji: { fontSize: 64, marginBottom: 8 },
  petPhoto: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  speciesText: { color: Colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 },
  chip: { backgroundColor: Colors.primaryLight },
  sectionCard: { marginBottom: 8 },
  editDialog: { maxHeight: '90%' },
  scrollArea: { maxHeight: 480 },
  photoContainer: { alignItems: 'center', marginBottom: 16 },
  photoPreview: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  photoEmoji: { fontSize: 24 },
  photoLabel: { color: Colors.primary, fontSize: 12, marginTop: 4 },
  input: { marginBottom: 10 },
  label: { marginBottom: 4, marginTop: 4, color: Colors.textSecondary },
  segment: { marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  menuButton: { marginBottom: 12, borderColor: Colors.border },
});
