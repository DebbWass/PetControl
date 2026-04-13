import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, FAB, Card, Chip, Button, TextInput, HelperText, Dialog, Portal, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy, where } from 'firebase/firestore';
import { subscribeToCollection, addRecord, updateRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Medication, MedicationType } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';

export default function MedicationsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [meds, setMeds] = useState<Medication[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [dosageInput, setDosageInput] = useState('');
  const [type, setType] = useState<MedicationType>('regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Medication>(
      paths.medications(familyId, petId),
      [where('isActive', '==', true), orderBy('createdAt', 'desc')],
      setMeds
    );
  }, [familyId, petId]);

  function reset() {
    setNameInput(''); setDosageInput(''); setType('regular'); setError('');
  }

  async function handleAdd() {
    if (!nameInput.trim() || !dosageInput.trim()) { setError(t('common.required')); return; }
    setLoading(true);
    try {
      await addRecord<Medication>(paths.medications(familyId, petId), {
        petId, familyId,
        name: nameInput.trim(),
        dosage: dosageInput.trim(),
        type,
        frequencyValue: 1,
        frequencyUnit: 'daily',
        startDate: Timestamp.now(),
        reminderEnabled: false,
        isActive: true,
        createdBy: user!.uid,
      });
      setDialogVisible(false); reset();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('medications.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {meds.length === 0
            ? <Text style={styles.empty}>{t('medications.noMedications')}</Text>
            : meds.map((m) => (
              <Card key={m.id} style={styles.card}>
                <Card.Title
                  title={m.name}
                  subtitle={m.dosage}
                  right={() => (
                    <Chip compact style={m.type === 'regular' ? styles.regularChip : styles.tempChip}>
                      {t(`medications.${m.type}`)}
                    </Chip>
                  )}
                />
                {m.endDate && (
                  <Card.Content>
                    <Text style={styles.dateText}>{t('medications.endDate')}: {formatDate(m.endDate)}</Text>
                  </Card.Content>
                )}
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('medications.add')}</Dialog.Title>
            <Dialog.Content>
              <TextInput label={t('medications.name')} value={nameInput} onChangeText={setNameInput} mode="outlined" style={styles.input} />
              <TextInput label={t('medications.dosage')} value={dosageInput} onChangeText={setDosageInput} mode="outlined" style={styles.input} />
              <SegmentedButtons
                value={type}
                onValueChange={(v) => setType(v as MedicationType)}
                buttons={[
                  { value: 'regular', label: t('medications.regular') },
                  { value: 'temporary', label: t('medications.temporary') },
                  { value: 'supplement', label: t('medications.supplement') },
                ]}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setDialogVisible(false); reset(); }}>{t('common.cancel')}</Button>
              <Button onPress={handleAdd} loading={loading} textColor={Colors.primary}>{t('common.save')}</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  regularChip: { backgroundColor: Colors.primaryLight, marginRight: 8 },
  tempChip: { backgroundColor: Colors.secondaryLight, marginRight: 8 },
  dateText: { color: Colors.textSecondary, fontSize: 13 },
});
