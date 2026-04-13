import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, FAB, Card, Chip, Button, TextInput, HelperText, Dialog, Portal, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { subscribeToCollection, addRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Treatment, TreatmentCategory } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';

export default function TreatmentsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [product, setProduct] = useState('');
  const [category, setCategory] = useState<TreatmentCategory>('flea_tick');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Treatment>(
      paths.treatments(familyId, petId),
      [orderBy('treatmentDate', 'desc')],
      setTreatments
    );
  }, [familyId, petId]);

  function reset() { setProduct(''); setCategory('flea_tick'); setError(''); }

  async function handleAdd() {
    if (!product.trim()) { setError(t('common.required')); return; }
    setLoading(true);
    try {
      const defaultDays = category === 'deworming' ? 90 : 30;
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + defaultDays);

      await addRecord<Treatment>(paths.treatments(familyId, petId), {
        petId, familyId,
        category,
        productName: product.trim(),
        treatmentDate: Timestamp.now(),
        nextDueDate: Timestamp.fromDate(nextDue),
        reminderEnabled: true,
        reminderDaysBeforeDue: 14,
        createdBy: user!.uid,
      });
      setDialogVisible(false); reset();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('treatments.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {treatments.length === 0
            ? <Text style={styles.empty}>{t('treatments.noTreatments')}</Text>
            : treatments.map((tr) => (
              <Card key={tr.id} style={styles.card}>
                <Card.Title
                  title={tr.productName}
                  subtitle={`${formatDate(tr.treatmentDate)} → ${t('treatments.nextDue')}: ${formatDate(tr.nextDueDate)}`}
                  right={() => (
                    <Chip compact style={styles.chip}>{t(`treatments.${tr.category}`)}</Chip>
                  )}
                />
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('treatments.add')}</Dialog.Title>
            <Dialog.Content>
              <SegmentedButtons
                value={category}
                onValueChange={(v) => setCategory(v as TreatmentCategory)}
                buttons={[
                  { value: 'flea_tick', label: t('treatments.flea_tick') },
                  { value: 'deworming', label: t('treatments.deworming') },
                  { value: 'other', label: t('treatments.other') },
                ]}
                style={styles.segment}
              />
              <TextInput label={t('treatments.product')} value={product} onChangeText={setProduct} mode="outlined" style={styles.input} />
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
  segment: { marginBottom: 12 },
  chip: { marginRight: 8, backgroundColor: Colors.primaryLight },
});
