import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, FAB, Card, TextInput, Button, HelperText, Dialog, Portal } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore';
import {
  subscribeToCollection,
  addRecord,
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

  async function handleAdd() {
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) {
      setError(t('common.required'));
      return;
    }
    setLoading(true);
    try {
      await addRecord<WeightRecord>(paths.weights(familyId, petId), {
        petId,
        familyId,
        weightKg: kg,
        recordedDate: Timestamp.now(),
        notes: notesInput.trim() || undefined,
        recordedBy: user!.uid,
      });
      setDialogVisible(false);
      setWeightInput('');
      setNotesInput('');
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartData = records.slice(0, 10).reverse();
  const hasChart = chartData.length >= 2;

  return (
    <>
      <Stack.Screen options={{ title: t('weight.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {hasChart && (
            <LineChart
              data={{
                labels: chartData.map((r) => formatDate(r.recordedDate, 'dd/MM')),
                datasets: [{ data: chartData.map((r) => r.weightKg) }],
              }}
              width={screenWidth - 32}
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
              style={styles.chart}
            />
          )}

          {records.length === 0 ? (
            <Text style={styles.empty}>{t('weight.noRecords')}</Text>
          ) : (
            records.map((r) => (
              <Card key={r.id} style={styles.card}>
                <Card.Title
                  title={`${r.weightKg} ק"ג`}
                  subtitle={formatDate(r.recordedDate)}
                  right={(props) => (
                    <Button
                      {...props}
                      textColor={Colors.danger}
                      onPress={() => deleteRecord(paths.weights(familyId, petId), r.id)}
                    >
                      ✕
                    </Button>
                  )}
                />
              </Card>
            ))
          )}
        </ScrollView>

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setDialogVisible(true)}
        />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
            <Dialog.Title>{t('weight.add')}</Dialog.Title>
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
                label={t('common.notes')}
                value={notesInput}
                onChangeText={setNotesInput}
                mode="outlined"
                style={styles.input}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDialogVisible(false)}>{t('common.cancel')}</Button>
              <Button onPress={handleAdd} loading={loading} textColor={Colors.primary}>
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
  chart: { marginBottom: 16, borderRadius: 12 },
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
});
