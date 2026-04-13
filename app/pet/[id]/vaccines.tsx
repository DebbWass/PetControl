import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, FAB, Card, Chip, Button, TextInput, HelperText, Dialog, Portal } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { subscribeToCollection, addRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Vaccine } from '../../../src/types';
import { formatDate, daysUntil } from '../../../src/utils/dateUtils';

export default function VaccinesScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [vetInput, setVetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Vaccine>(
      paths.vaccines(familyId, petId),
      [orderBy('vaccinationDate', 'desc')],
      setVaccines
    );
  }, [familyId, petId]);

  function reset() { setNameInput(''); setVetInput(''); setError(''); }

  async function handleAdd() {
    if (!nameInput.trim()) { setError(t('common.required')); return; }
    setLoading(true);
    try {
      await addRecord<Vaccine>(paths.vaccines(familyId, petId), {
        petId, familyId,
        name: nameInput.trim(),
        vaccinationDate: Timestamp.now(),
        veterinarian: vetInput.trim() || undefined,
        reminderEnabled: true,
        reminderDaysBeforeDue: 30,
        createdBy: user!.uid,
      });
      setDialogVisible(false); reset();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function getDueChipColor(v: Vaccine): string {
    if (!v.nextDueDate) return Colors.border;
    const days = daysUntil(v.nextDueDate);
    if (days === null) return Colors.border;
    if (days < 0) return Colors.danger;
    if (days <= 30) return Colors.warning;
    return Colors.success;
  }

  return (
    <>
      <Stack.Screen options={{ title: t('vaccines.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {vaccines.length === 0
            ? <Text style={styles.empty}>{t('vaccines.noVaccines')}</Text>
            : vaccines.map((v) => (
              <Card key={v.id} style={styles.card}>
                <Card.Title
                  title={v.name}
                  subtitle={`${t('vaccines.date')}: ${formatDate(v.vaccinationDate)}`}
                  right={() => v.nextDueDate ? (
                    <Chip compact style={[styles.chip, { borderColor: getDueChipColor(v) }]}>
                      {t('vaccines.nextDue')}: {formatDate(v.nextDueDate)}
                    </Chip>
                  ) : null}
                />
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('vaccines.add')}</Dialog.Title>
            <Dialog.Content>
              <TextInput label={t('vaccines.name')} value={nameInput} onChangeText={setNameInput} mode="outlined" style={styles.input} />
              <TextInput label={`${t('vaccines.veterinarian')} (${t('common.optional')})`} value={vetInput} onChangeText={setVetInput} mode="outlined" style={styles.input} />
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
  chip: { marginRight: 8, borderWidth: 1 },
});
