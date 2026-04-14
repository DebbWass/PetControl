import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, Menu,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { parse, isValid } from 'date-fns';
import { subscribeToCollection, addRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Vaccine } from '../../../src/types';
import { formatDate, toTimestamp } from '../../../src/utils/dateUtils';
import { COMMON_VACCINES, CommonVaccine } from '../../../src/constants/vaccines';
import { calcVaccineNextDue } from '../../../src/utils/medicationUtils';

function daysUntil(ts: Timestamp | undefined): number | null {
  if (!ts) return null;
  const diff = ts.toDate().getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusColor(days: number | null): string {
  if (days === null) return Colors.textSecondary;
  if (days < 0) return Colors.danger;
  if (days <= 30) return Colors.warning;
  return Colors.success;
}

export default function VaccinesScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);

  // Form state
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState<CommonVaccine>(COMMON_VACCINES[0]);
  const [customName, setCustomName] = useState('');
  const [manualNextDue, setManualNextDue] = useState('');
  const [vetInput, setVetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOther = selectedVaccine.intervalDays === 0;

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Vaccine>(
      paths.vaccines(familyId, petId),
      [orderBy('vaccinationDate', 'desc')],
      setVaccines
    );
  }, [familyId, petId]);

  function reset() {
    setSelectedVaccine(COMMON_VACCINES[0]);
    setCustomName('');
    setManualNextDue('');
    setVetInput('');
    setError('');
  }

  async function handleAdd() {
    const vaccineName = isOther
      ? customName.trim()
      : (i18n.language === 'he' ? selectedVaccine.nameHe : selectedVaccine.nameEn);

    if (!vaccineName) {
      setError(t('common.required'));
      return;
    }

    let nextDue: Date | null = null;
    if (!isOther) {
      nextDue = calcVaccineNextDue(new Date(), selectedVaccine.intervalDays);
    } else if (manualNextDue.trim()) {
      const parsed = parse(manualNextDue.trim(), 'dd/MM/yyyy', new Date());
      if (!isValid(parsed)) {
        setError(t('vaccines.manualNextDue'));
        return;
      }
      nextDue = parsed;
    }

    setLoading(true);
    try {
      await addRecord<Vaccine>(paths.vaccines(familyId, petId), {
        petId,
        familyId,
        name: vaccineName,
        vaccinationDate: Timestamp.now(),
        nextDueDate: nextDue ? toTimestamp(nextDue) : undefined,
        veterinarian: vetInput.trim() || undefined,
        reminderEnabled: true,
        reminderDaysBeforeDue: 30,
        createdBy: user!.uid,
      });
      setDialogVisible(false);
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('vaccines.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {vaccines.length === 0
            ? <Text style={styles.empty}>{t('vaccines.noVaccines')}</Text>
            : vaccines.map((v) => {
              const days = daysUntil(v.nextDueDate);
              return (
                <Card key={v.id} style={styles.card}>
                  <Card.Title
                    title={v.name}
                    subtitle={formatDate(v.vaccinationDate)}
                    right={() => (
                      <Chip
                        compact
                        style={[styles.chip, { backgroundColor: statusColor(days) + '22' }]}
                        textStyle={{ color: statusColor(days) }}
                      >
                        {v.nextDueDate
                          ? (days !== null && days < 0
                            ? t('reminders.overdue')
                            : formatDate(v.nextDueDate))
                          : '—'}
                      </Chip>
                    )}
                  />
                </Card>
              );
            })
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('vaccines.add')}</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.label}>{t('vaccines.selectVaccine')}</Text>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setMenuVisible(true)}
                    style={styles.menuButton}
                  >
                    {i18n.language === 'he' ? selectedVaccine.nameHe : selectedVaccine.nameEn}
                  </Button>
                }
              >
                {COMMON_VACCINES.map((v) => (
                  <Menu.Item
                    key={v.nameEn}
                    title={i18n.language === 'he' ? v.nameHe : v.nameEn}
                    onPress={() => { setSelectedVaccine(v); setMenuVisible(false); }}
                  />
                ))}
              </Menu>

              {isOther && (
                <TextInput
                  label={t('vaccines.customName')}
                  value={customName}
                  onChangeText={setCustomName}
                  mode="outlined"
                  style={styles.input}
                />
              )}
              {isOther && (
                <TextInput
                  label={t('vaccines.manualNextDue')}
                  value={manualNextDue}
                  onChangeText={setManualNextDue}
                  mode="outlined"
                  style={styles.input}
                  placeholder="DD/MM/YYYY"
                />
              )}

              <TextInput
                label={`${t('vaccines.veterinarian')} (${t('common.optional')})`}
                value={vetInput}
                onChangeText={setVetInput}
                mode="outlined"
                style={styles.input}
              />
              {error ? <HelperText type="error">{error}</HelperText> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setDialogVisible(false); reset(); }}>{t('common.cancel')}</Button>
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
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  chip: { marginRight: 8 },
  label: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  menuButton: { marginBottom: 12 },
});
