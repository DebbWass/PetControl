import { useState } from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, HelperText, SegmentedButtons, Switch, Menu, ActivityIndicator } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { addPet, updatePet } from '../../src/services/firebase/firestore';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../src/constants/colors';
import { SPECIES_LIST } from '../../src/constants/species';
import { Species, Sex } from '../../src/types';
import { uploadPetPhoto } from '../../src/services/storage';
import { Timestamp } from 'firebase/firestore';

export default function NewPetScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isHe = i18n.language === 'he';

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('cat');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<Sex>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [color, setColor] = useState('');
  const [isNeutered, setIsNeutered] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [speciesMenuVisible, setSpeciesMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedSpecies = SPECIES_LIST.find((s) => s.key === species);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t('common.required'));
      return;
    }
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const yearNum = parseInt(birthYear, 10);
      const birthdateTs = birthYear.trim() && !isNaN(yearNum)
        ? Timestamp.fromDate(new Date(yearNum, 0, 1))
        : undefined;

      const petId = await addPet(user.familyId, {
        familyId: user.familyId,
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        sex,
        birthdate: birthdateTs,
        birthYear: birthYear.trim() && !isNaN(yearNum) ? yearNum : undefined,
        color: color.trim() || undefined,
        isNeutered,
        isActive: true,
        createdBy: user.uid,
      });

      if (photoUri) {
        const photoUrl = await uploadPetPhoto(user.familyId, petId, photoUri);
        await updatePet(user.familyId, petId, { photoUrl });
      }

      router.back();
    } catch (e: any) {
      setError(e.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>{t('pets.addPet')}</Text>

      {/* Photo picker */}
      <TouchableOpacity onPress={handlePickPhoto} style={styles.photoContainer}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>📷</Text>
            <Text style={styles.photoLabel}>{t('pets.addPhoto')}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Name */}
      <TextInput
        label={t('pets.name')}
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
      />

      {/* Birth Year */}
      <TextInput
        label={`${t('pets.birthYear')} (${t('common.optional')})`}
        value={birthYear}
        onChangeText={setBirthYear}
        mode="outlined"
        keyboardType="number-pad"
        style={styles.input}
        maxLength={4}
      />

      {/* Species picker */}
      <Menu
        visible={speciesMenuVisible}
        onDismiss={() => setSpeciesMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setSpeciesMenuVisible(true)}
            style={styles.menuButton}
            icon={() => <Text>{selectedSpecies?.emoji}</Text>}
          >
            {isHe ? selectedSpecies?.labelHe : selectedSpecies?.labelEn}
          </Button>
        }
      >
        <ScrollView style={{ maxHeight: 300 }}>
          {SPECIES_LIST.map((s) => (
            <Menu.Item
              key={s.key}
              title={`${s.emoji} ${isHe ? s.labelHe : s.labelEn}`}
              onPress={() => {
                setSpecies(s.key);
                setSpeciesMenuVisible(false);
              }}
            />
          ))}
        </ScrollView>
      </Menu>

      {/* Sex */}
      <Text variant="labelLarge" style={styles.label}>{t('pets.sex')}</Text>
      <SegmentedButtons
        value={sex}
        onValueChange={(v) => setSex(v as Sex)}
        buttons={[
          { value: 'male', label: t('pets.male') },
          { value: 'female', label: t('pets.female') },
          { value: 'unknown', label: t('pets.unknown') },
        ]}
        style={styles.segment}
      />

      {/* Breed */}
      <TextInput
        label={`${t('pets.breed')} (${t('common.optional')})`}
        value={breed}
        onChangeText={setBreed}
        mode="outlined"
        style={styles.input}
      />

      {/* Color */}
      <TextInput
        label={`${t('pets.color')} (${t('common.optional')})`}
        value={color}
        onChangeText={setColor}
        mode="outlined"
        style={styles.input}
      />

      {/* Neutered */}
      <View style={styles.switchRow}>
        <Text variant="bodyLarge" style={styles.switchLabel}>{t('pets.isNeutered')}</Text>
        <View style={styles.switchControl}>
          <Text variant="bodyMedium" style={styles.switchValue}>
            {isNeutered ? t('common.yes') : t('common.no')}
          </Text>
          <Switch
            value={isNeutered}
            onValueChange={setIsNeutered}
            color={Colors.primary}
          />
        </View>
      </View>

      {error ? <HelperText type="error">{error}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleSave}
        loading={loading}
        style={styles.saveButton}
        buttonColor={Colors.primary}
      >
        {t('common.save')}
      </Button>

      <Button mode="text" onPress={() => router.back()} style={styles.cancelButton}>
        {t('common.cancel')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { marginBottom: 16 },
  photoContainer: { alignSelf: 'center', marginBottom: 20 },
  photoPreview: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  photoEmoji: { fontSize: 28 },
  photoLabel: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 2 },
  input: { marginBottom: 12 },
  label: { marginBottom: 4, marginTop: 8, color: Colors.textSecondary },
  segment: { marginBottom: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  switchLabel: { flex: 1 },
  switchControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchValue: { color: Colors.textSecondary },
  menuButton: { marginBottom: 16, borderColor: Colors.border },
  saveButton: { marginTop: 8, borderRadius: 8 },
  cancelButton: { marginTop: 4 },
});
