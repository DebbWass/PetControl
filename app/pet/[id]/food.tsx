import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { BarChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { subscribeToCollection, addRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { FoodRecord, FoodType } from '../../../src/types';
import { formatDateTime } from '../../../src/utils/dateUtils';

const screenWidth = Dimensions.get('window').width;

export default function FoodScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
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

  function reset() {
    setFoodName('');
    setFoodBrand('');
    setFoodType('dry');
    setAmountInput('');
    setError('');
  }

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
      setDialogVisible(false);
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Today's total
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTotal = records
    .filter((r) => r.feedingDate?.toDate() >= today)
    .reduce((sum, r) => sum + r.amountGrams, 0);

  // Weekly chart data (last 7 days)
  const locale = i18n.language === 'he' ? heLocale : enUS;
  const now = new Date();
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (6 - i));
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const total = records
      .filter((r) => {
        const d = r.feedingDate?.toDate();
        return d && d >= day && d < nextDay;
      })
      .reduce((sum, r) => sum + r.amountGrams, 0);
    return { label: format(day, 'EEE', { locale }), total };
  });
  const hasWeekData = weekData.some((d) => d.total > 0);

  return (
    <>
      <Stack.Screen options={{ title: t('food.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {hasWeekData && (
            <Card style={styles.chartCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.chartTitle}>{t('food.weeklyChart')}</Text>
                <BarChart
                  data={{
                    labels: weekData.map((d) => d.label),
                    datasets: [{ data: weekData.map((d) => d.total) }],
                  }}
                  width={screenWidth - 64}
                  height={160}
                  yAxisSuffix="g"
                  yAxisLabel=""
                  chartConfig={{
                    backgroundColor: Colors.surface,
                    backgroundGradientFrom: Colors.surface,
                    backgroundGradientTo: Colors.surface,
                    decimalPlaces: 0,
                    color: () => Colors.primary,
                    labelColor: () => Colors.textSecondary,
                  }}
                  showValuesOnTopOfBars
                  style={styles.chart}
                />
              </Card.Content>
            </Card>
          )}

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
  chartCard: { marginBottom: 12 },
  chartTitle: { marginBottom: 8, color: Colors.textSecondary },
  chart: { borderRadius: 8, marginLeft: -16 },
  summaryCard: { marginBottom: 12, backgroundColor: Colors.primaryLight },
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  segment: { marginBottom: 12 },
  chip: { marginRight: 8, backgroundColor: Colors.secondaryLight },
});
