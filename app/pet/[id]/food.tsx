import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, FAB, Card, Chip, Button, TextInput, HelperText, Dialog, Portal, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { subscribeToCollection, addRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { FoodRecord, FoodType } from '../../../src/types';
import { formatDateTime } from '../../../src/utils/dateUtils';

export default function FoodScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [records, setRecords] = useState<FoodRecord[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodBrand, setFoodBrand] = useState('');
  const [foodType, setFoodType] = useState<FoodType>('dry');
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<FoodRecord>(
      paths.food(familyId, petId),
      [orderBy('feedingDate', 'desc')],
      setRecords
    );
  }, [familyId, petId]);

  function reset() { setFoodName(''); setFoodBrand(''); setFoodType('dry'); setAmountInput(''); setError(''); }

  async function handleAdd() {
    if (!foodName.trim() || !amountInput) { setError(t('common.required')); return; }
    const amount = parseFloat(amountInput.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { setError(t('common.required')); return; }
    setLoading(true);
    try {
      await addRecord<FoodRecord>(paths.food(familyId, petId), {
        petId, familyId,
        foodName: foodName.trim(),
        foodBrand: foodBrand.trim() || undefined,
        foodType,
        amountGrams: amount,
        feedingDate: Timestamp.now(),
        recordedBy: user!.uid,
      });
      setDialogVisible(false); reset();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Calculate today's total
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTotal = records
    .filter((r) => r.feedingDate?.toDate() >= today)
    .reduce((sum, r) => sum + r.amountGrams, 0);

  return (
    <>
      <Stack.Screen options={{ title: t('food.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {todayTotal > 0 && (
            <Card style={styles.summaryCard}>
              <Card.Content>
                <Text variant="titleMedium">{t('food.todayTotal')}: {todayTotal}g</Text>
              </Card.Content>
            </Card>
          )}

          {records.length === 0
            ? <Text style={styles.empty}>{t('food.noRecords')}</Text>
            : records.map((r) => (
              <Card key={r.id} style={styles.card}>
                <Card.Title
                  title={`${r.foodName}${r.foodBrand ? ` · ${r.foodBrand}` : ''}`}
                  subtitle={`${r.amountGrams}g · ${formatDateTime(r.feedingDate)}`}
                  right={() => (
                    <Chip compact style={styles.chip}>{t(`food.${r.foodType}`)}</Chip>
                  )}
                />
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('food.add')}</Dialog.Title>
            <Dialog.Content>
              <SegmentedButtons
                value={foodType}
                onValueChange={(v) => setFoodType(v as FoodType)}
                buttons={[
                  { value: 'dry', label: t('food.dry') },
                  { value: 'wet', label: t('food.wet') },
                  { value: 'raw', label: t('food.raw') },
                  { value: 'treat', label: t('food.treat') },
                ]}
                style={styles.segment}
              />
              <TextInput label={t('food.name')} value={foodName} onChangeText={setFoodName} mode="outlined" style={styles.input} />
              <TextInput label={`${t('food.brand')} (${t('common.optional')})`} value={foodBrand} onChangeText={setFoodBrand} mode="outlined" style={styles.input} />
              <TextInput label={t('food.amount')} value={amountInput} onChangeText={setAmountInput} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
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
  summaryCard: { marginBottom: 12, backgroundColor: Colors.primaryLight },
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  segment: { marginBottom: 12 },
  chip: { marginRight: 8, backgroundColor: Colors.secondaryLight },
});
