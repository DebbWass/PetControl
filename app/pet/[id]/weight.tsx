import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text, FAB, Card, TextInput, Button, HelperText, Dialog, Portal, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore';
import {
  subscribeToCollection,
  addRecord,
  updateRecord,
  deleteRecord,
  paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { WeightRecord } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';

const screenWidth = Dimensions.get('window').width;

export default function WeightScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    const unsubscribe = subscribeToCollection<WeightRecord>(
      paths.weights(familyId, petId),
      [orderBy('recordedDate', 'desc')],
      setRecords
    );
    return unsubscribe;
  }, [familyId, petId]);

  function reset() {
    setEditingRecord(null);
    setWeightInput('');
    setNotesInput('');
    setError('');
  }

  function openEdit(r: WeightRecord) {
    setEditingRecord(r);
    setWeightInput(String(r.weightKg));
    setNotesInput(r.notes ?? '');
    setError('');
    setDialogVisible(true);
  }

  async function handleSave() {
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) {
      setError(t('common.required'));
      return;
    }
    setLoading(true);
    try {
      if (editingRecord) {
        await updateRecord<WeightRecord>(paths.weights(familyId, petId), editingRecord.id, {
          weightKg: kg,
          notes: notesInput.trim() || undefined,
        });
      } else {
        await addRecord<WeightRecord>(paths.weights(familyId, petId), {
          petId,
          familyId,
          weightKg: kg,
          recordedDate: Timestamp.now(),
          notes: notesInput.trim() || undefined,
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

  function confirmDelete(r: WeightRecord) {
    Alert.alert(t('common.delete'), `${r.weightKg} ק"ג – ${formatDate(r.recordedDate)}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteRecord(paths.weights(familyId, petId), r.id),
      },
    ]);
  }

  const chartData = records.slice(0, 10).reverse();
  const hasChart = chartData.length >= 2;

  // Trend calculation
  let trendKey: 'up' | 'down' | 'stable' | null = null;
  if (records.length >= 2) {
    const diff = records[0].weightKg - records[1].weightKg;
    if (diff > 0.05) trendKey = 'up';
    else if (diff < -0.05) trendKey = 'down';
    else trendKey = 'stable';
  }

  return (
    <>
      <Stack.Screen options={{ title: t('weight.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {hasChart && (
            <Card style={styles.chartCard}>
              <Card.Content>
                <View style={styles.chartHeader}>
                  <Text variant="titleSmall" style={styles.chartTitle}>{t('weight.trend')}</Text>
                  {trendKey && (
                    <Text style={styles.trendText}>
                      {trendKey === 'up' ? '▲ ' : trendKey === 'down' ? '▼ ' : '— '}
                      {t(`weight.${trendKey}`)}
                    </Text>
                  )}
                </View>
                <LineChart
                  data={{
                    labels: chartData.map((r) => formatDate(r.recordedDate, 'dd/MM')),
                    datasets: [{ data: chartData.map((r) => r.weightKg) }],
                  }}
                  width={screenWidth - 64}
                  height={200}
                  chartConfig={{
                    backgroundColor: Colors.surface,
                    backgroundGradientFrom: Colors.surface,
                    backgroundGradientTo: Colors.surface,
                    decimalPlaces: 1,
                    color: () => Colors.primary,
                    labelColor: () => Colors.textSecondary,
                  }}
                  bezier
                  yAxisSuffix=' ק"ג'
                  style={styles.chart}
                />
              </Card.Content>
            </Card>
          )}

          {records.length === 0 ? (
            <Text style={styles.empty}>{t('weight.noRecords')}</Text>
          ) : (
            records.map((r) => (
              <Card key={r.id} style={styles.card}>
                <Card.Title
                  title={`${r.weightKg} ק"ג`}
                  subtitle={`${formatDate(r.recordedDate)}${r.notes ? ` · ${r.notes}` : ''}`}
                  right={() => (
                    <View style={styles.cardRight}>
                      <IconButton icon="pencil" size={18} onPress={() => openEdit(r)} />
                      <IconButton
                        icon="delete"
                        size={18}
                        iconColor={Colors.danger}
                        onPress={() => confirmDelete(r)}
                      />
                    </View>
                  )}
                />
              </Card>
            ))
          )}
        </ScrollView>

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => { reset(); setDialogVisible(true); }}
        />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingRecord ? t('common.edit') : t('weight.add')}</Dialog.Title>
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
            <Dialog.Content>
              <TextInput
                label={t('weight.weightKg')}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={`${t('common.notes')} (${t('common.optional')})`}
                value={notesInput}
                onChangeText={setNotesInput}
                mode="outlined"
                style={styles.input}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Dialog.Content>
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
  chartCard: { marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle: { color: Colors.textSecondary },
  trendText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  chart: { borderRadius: 12, marginLeft: -16 },
  card: { marginBottom: 8 },
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
});
