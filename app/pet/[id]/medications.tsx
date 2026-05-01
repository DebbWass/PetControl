import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons, Switch, List, IconButton, Menu,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy, where } from 'firebase/firestore';
import {
  subscribeToCollection, addRecord, updateRecord, paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Medication, MedicationType, FrequencyUnit } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';
import { calcMedicationNextDue } from '../../../src/utils/medicationUtils';
import { toTimestamp } from '../../../src/utils/dateUtils';

const DOSAGE_UNITS = ['pill', 'ml', 'units_dose'] as const;

export default function MedicationsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [meds, setMeds] = useState<Medication[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // Form state
  const [nameInput, setNameInput] = useState('');
  const [dosageInput, setDosageInput] = useState('');
  const [dosageUnit, setDosageUnit] = useState('pill');
  const [dosageUnitMenuVisible, setDosageUnitMenuVisible] = useState(false);
  const [type, setType] = useState<MedicationType>('regular');
  const [frequencyValue, setFrequencyValue] = useState('1');
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>('daily');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
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
    setEditingMed(null);
    setNameInput('');
    setDosageInput('');
    setDosageUnit('pill');
    setType('regular');
    setFrequencyValue('1');
    setFrequencyUnit('daily');
    setReminderEnabled(false);
    setReminderTime('08:00');
    setError('');
  }

  function openEdit(med: Medication) {
    setEditingMed(med);
    setNameInput(med.name);
    setDosageInput(med.dosage);
    setDosageUnit(med.dosageUnit ?? 'pill');
    setType(med.type);
    setFrequencyValue(String(med.frequencyValue));
    setFrequencyUnit(med.frequencyUnit);
    setReminderEnabled(med.reminderEnabled);
    setReminderTime(med.reminderTime ?? '08:00');
    setError('');
    setDialogVisible(true);
  }

  async function handleSave() {
    if (!nameInput.trim() || !dosageInput.trim()) {
      setError(t('common.required'));
      return;
    }
    const fv = parseInt(frequencyValue, 10) || 1;
    setLoading(true);
    try {
      if (editingMed) {
        const nextDue = calcMedicationNextDue(new Date(), fv, frequencyUnit);
        await updateRecord<Medication>(paths.medications(familyId, petId), editingMed.id, {
          name: nameInput.trim(),
          dosage: dosageInput.trim(),
          dosageUnit,
          type,
          frequencyValue: fv,
          frequencyUnit,
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTime : undefined,
          nextDueDate: nextDue ? toTimestamp(nextDue) : undefined,
        });
      } else {
        const nextDue = calcMedicationNextDue(new Date(), fv, frequencyUnit);
        await addRecord<Medication>(paths.medications(familyId, petId), {
          petId,
          familyId,
          name: nameInput.trim(),
          dosage: dosageInput.trim(),
          dosageUnit,
          type,
          frequencyValue: fv,
          frequencyUnit,
          startDate: Timestamp.now(),
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTime : undefined,
          nextDueDate: nextDue ? toTimestamp(nextDue) : undefined,
          isActive: true,
          createdBy: user!.uid,
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

  async function handleDeactivate(id: string) {
    await updateRecord<Medication>(paths.medications(familyId, petId), id, { isActive: false });
  }

  function dosageUnitLabel(unit: string) {
    if (unit === 'pill') return t('medications.pill');
    if (unit === 'ml') return t('medications.ml');
    return t('medications.units_dose');
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
                  subtitle={`${m.dosage}${m.dosageUnit ? ' ' + dosageUnitLabel(m.dosageUnit) : ''}`}
                  right={() => (
                    <View style={styles.cardActions}>
                      <Chip compact style={m.type === 'regular' ? styles.regularChip : styles.tempChip}>
                        {t(`medications.${m.type}`)}
                      </Chip>
                      <IconButton icon="pencil" size={18} onPress={() => openEdit(m)} />
                    </View>
                  )}
                />
                <Card.Content>
                  {m.nextDueDate && (
                    <Text style={styles.dateText}>
                      {t('medications.frequencyValue')}: {formatDate(m.nextDueDate)}
                    </Text>
                  )}
                  <Text style={styles.freqText}>
                    {t('medications.frequency')}: {t(`medications.${m.frequencyUnit}`)}
                    {m.frequencyUnit !== 'as_needed' ? ` ×${m.frequencyValue}` : ''}
                  </Text>
                </Card.Content>
                <Card.Actions>
                  <Button
                    compact
                    textColor={Colors.danger}
                    onPress={() => handleDeactivate(m.id)}
                  >
                    {t('medications.inactive')}
                  </Button>
                </Card.Actions>
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => { reset(); setDialogVisible(true); }} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingMed ? t('common.edit') : t('medications.add')}</Dialog.Title>
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
            <Dialog.ScrollArea style={styles.scrollArea}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TextInput
                  label={t('medications.name')}
                  value={nameInput}
                  onChangeText={setNameInput}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Dosage: numeric + unit */}
                <View style={styles.dosageRow}>
                  <TextInput
                    label={t('medications.dosage')}
                    value={dosageInput}
                    onChangeText={setDosageInput}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    style={styles.dosageInput}
                  />
                  <Menu
                    visible={dosageUnitMenuVisible}
                    onDismiss={() => setDosageUnitMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setDosageUnitMenuVisible(true)}
                        style={styles.unitButton}
                      >
                        {dosageUnitLabel(dosageUnit)}
                      </Button>
                    }
                  >
                    {DOSAGE_UNITS.map((u) => (
                      <Menu.Item
                        key={u}
                        title={dosageUnitLabel(u)}
                        onPress={() => { setDosageUnit(u); setDosageUnitMenuVisible(false); }}
                      />
                    ))}
                  </Menu>
                </View>

                <SegmentedButtons
                  value={type}
                  onValueChange={(v) => setType(v as MedicationType)}
                  buttons={[
                    { value: 'regular', label: t('medications.regular') },
                    { value: 'temporary', label: t('medications.temporary') },
                    { value: 'supplement', label: t('medications.supplement') },
                  ]}
                  style={styles.segment}
                />

                <Text style={styles.sectionLabel}>{t('medications.frequency')}</Text>
                <SegmentedButtons
                  value={frequencyUnit}
                  onValueChange={(v) => setFrequencyUnit(v as FrequencyUnit)}
                  buttons={[
                    { value: 'daily', label: t('medications.daily') },
                    { value: 'weekly', label: t('medications.weekly') },
                    { value: 'monthly', label: t('medications.monthly') },
                    { value: 'as_needed', label: t('medications.as_needed') },
                  ]}
                  style={styles.segment}
                />
                {frequencyUnit !== 'as_needed' && (
                  <TextInput
                    label={t('medications.frequencyValue')}
                    value={frequencyValue}
                    onChangeText={setFrequencyValue}
                    keyboardType="number-pad"
                    mode="outlined"
                    style={styles.input}
                  />
                )}

                <List.Item
                  title={t('medications.reminderEnabled')}
                  right={() => (
                    <Switch
                      value={reminderEnabled}
                      onValueChange={setReminderEnabled}
                      color={Colors.primary}
                    />
                  )}
                />
                {reminderEnabled && (
                  <TextInput
                    label={t('medications.reminderTimeLabel')}
                    value={reminderTime}
                    onChangeText={setReminderTime}
                    mode="outlined"
                    style={styles.input}
                    placeholder="08:00"
                  />
                )}

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
  card: { marginBottom: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  segment: { marginBottom: 12 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 4 },
  regularChip: { backgroundColor: Colors.primaryLight },
  tempChip: { backgroundColor: Colors.secondaryLight },
  dateText: { color: Colors.textSecondary, fontSize: 13 },
  freqText: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  scrollArea: { maxHeight: 460 },
  dosageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dosageInput: { flex: 1 },
  unitButton: { borderColor: Colors.border, minWidth: 90 },
});
