import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons, IconButton, Menu,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { BarChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import {
  subscribeToCollection, addRecord, updateRecord, deleteRecord, paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { FoodRecord, FoodType } from '../../../src/types';
import { formatDateTime } from '../../../src/utils/dateUtils';

const screenWidth = Dimensions.get('window').width;
const AMOUNT_UNITS = ['gram', 'cups', 'pouch'] as const;

export default function FoodScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [records, setRecords] = useState<FoodRecord[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FoodRecord | null>(null);

  // Form state
  const [foodName, setFoodName] = useState('');
  const [foodBrand, setFoodBrand] = useState('');
  const [foodType, setFoodType] = useState<FoodType>('dry');
  const [amountInput, setAmountInput] = useState('');
  const [amountUnit, setAmountUnit] = useState<string>('gram');
  const [amountUnitMenuVisible, setAmountUnitMenuVisible] = useState(false);
  const [notesInput, setNotesInput] = useState('');
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
    setEditingRecord(null);
    setFoodName('');
    setFoodBrand('');
    setFoodType('dry');
    setAmountInput('');
    setAmountUnit('gram');
    setNotesInput('');
    setError('');
  }

  function openEdit(r: FoodRecord) {
    setEditingRecord(r);
    setFoodName(r.foodName);
    setFoodBrand(r.foodBrand ?? '');
    setFoodType(r.foodType);
    setAmountInput(String(r.amountGrams));
    setAmountUnit(r.amountUnit ?? 'gram');
    setNotesInput(r.notes ?? '');
    setError('');
    setDialogVisible(true);
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!foodName.trim()) missing.push(t('food.name'));
    if (!amountInput.trim()) missing.push(t('food.amount'));
    if (missing.length > 0) {
      setError(t('common.missingFields', { fields: missing.join(', ') }));
      return;
    }
    const amount = parseFloat(amountInput.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { setError(t('common.invalidNumber')); return; }
    setLoading(true);
    try {
      if (editingRecord) {
        await updateRecord<FoodRecord>(paths.food(familyId, petId), editingRecord.id, {
          foodName: foodName.trim(),
          foodBrand: foodBrand.trim() || undefined,
          foodType,
          amountGrams: amount,
          amountUnit,
          notes: notesInput.trim() || undefined,
        });
      } else {
        await addRecord<FoodRecord>(paths.food(familyId, petId), {
          petId, familyId,
          foodName: foodName.trim(),
          foodBrand: foodBrand.trim() || undefined,
          foodType,
          amountGrams: amount,
          amountUnit,
          notes: notesInput.trim() || undefined,
          feedingDate: Timestamp.now(),
          recordedBy: user!.uid,
        });
      }
      setDialogVisible(false);
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function unitLabel(unit: string) {
    if (unit === 'gram') return t('food.gram');
    if (unit === 'cups') return t('food.cups');
    return t('food.pouch');
  }

  // Today's total (gram records only for accuracy)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTotal = records
    .filter((r) => r.feedingDate?.toDate() >= today && (!r.amountUnit || r.amountUnit === 'gram'))
    .reduce((sum, r) => sum + r.amountGrams, 0);

  // Weekly chart data
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
        return d && d >= day && d < nextDay && (!r.amountUnit || r.amountUnit === 'gram');
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
                  subtitle={`${r.amountGrams} ${unitLabel(r.amountUnit ?? 'gram')} · ${formatDateTime(r.feedingDate)}`}
                  right={() => (
                    <View style={styles.cardRight}>
                      <Chip compact style={styles.chip}>{t(`food.${r.foodType}`)}</Chip>
                      <IconButton icon="pencil" size={18} onPress={() => openEdit(r)} />
                    </View>
                  )}
                />
                {r.notes ? (
                  <Card.Content>
                    <Text style={styles.notes}>{r.notes}</Text>
                  </Card.Content>
                ) : null}
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => { reset(); setDialogVisible(true); }} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingRecord ? t('common.edit') : t('food.add')}</Dialog.Title>
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
            <Dialog.ScrollArea style={styles.scrollArea}>
              <ScrollView keyboardShouldPersistTaps="handled">
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
                <TextInput
                  label={t('food.name')}
                  value={foodName}
                  onChangeText={setFoodName}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={`${t('food.brand')} (${t('common.optional')})`}
                  value={foodBrand}
                  onChangeText={setFoodBrand}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Amount + Unit */}
                <View style={styles.amountRow}>
                  <TextInput
                    label={t('food.amount')}
                    value={amountInput}
                    onChangeText={setAmountInput}
                    keyboardType="decimal-pad"
                    mode="outlined"
                    style={styles.amountInput}
                  />
                  <Menu
                    visible={amountUnitMenuVisible}
                    onDismiss={() => setAmountUnitMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setAmountUnitMenuVisible(true)}
                        style={styles.unitButton}
                      >
                        {unitLabel(amountUnit)}
                      </Button>
                    }
                  >
                    {AMOUNT_UNITS.map((u) => (
                      <Menu.Item
                        key={u}
                        title={unitLabel(u)}
                        onPress={() => { setAmountUnit(u); setAmountUnitMenuVisible(false); }}
                      />
                    ))}
                  </Menu>
                </View>

                <TextInput
                  label={`${t('common.notes')} (${t('common.optional')})`}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />

                {error ? <HelperText type="error">{error}</HelperText> : null}
              </ScrollView>
            </Dialog.ScrollArea>
            </KeyboardAvoidingView>
            <Dialog.Actions>
              <Button onPress={() => { setDialogVisible(false); reset(); }}>{t('common.cancel')}</Button>
              <Button onPress={handleSave} loading={loading} textColor={Colors.primary}>
                {t('common.save')}
              </Button>
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
  cardRight: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  segment: { marginBottom: 12 },
  chip: { backgroundColor: Colors.secondaryLight },
  notes: { color: Colors.textSecondary, fontSize: 13 },
  scrollArea: { maxHeight: 460 },
  amountRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  amountInput: { flex: 1 },
  unitButton: { borderColor: Colors.border, minWidth: 90 },
});
