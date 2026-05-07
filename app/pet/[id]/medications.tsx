import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons, Switch, List, IconButton, Menu,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import {
  subscribeToCollection, addRecord, updateRecord, deleteRecord, paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Medication, MedicationType, FrequencyUnit } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';
import { calcMedicationNextDue } from '../../../src/utils/medicationUtils';
import { toTimestamp } from '../../../src/utils/dateUtils';
import { addDays, addWeeks } from 'date-fns';

const DOSAGE_UNITS = ['pill', 'ml', 'units_dose'] as const;
const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

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

  // Change 1: Temporary duration
  const [durationValue, setDurationValue] = useState('7');
  const [durationUnit, setDurationUnit] = useState<'days' | 'weeks'>('days');
  const [durationMenuVisible, setDurationMenuVisible] = useState(false);

  // Change 5: Smart reminder
  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00']);
  const [reminderWeekDay, setReminderWeekDay] = useState(0);
  const [reminderWeekDayMenuVisible, setReminderWeekDayMenuVisible] = useState(false);
  const [reminderMonthDay, setReminderMonthDay] = useState('1');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Medication>(
      paths.medications(familyId, petId),
      [],
      (items) => {
        const sorted = [...items].sort(
          (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
        );
        setMeds(sorted);
      }
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
    setDurationValue('7');
    setDurationUnit('days');
    setReminderTimes(['08:00']);
    setReminderWeekDay(0);
    setReminderMonthDay('1');
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
    // Change 1
    if (med.durationValue && med.durationUnit) {
      setDurationValue(String(med.durationValue));
      setDurationUnit(med.durationUnit);
    } else {
      setDurationValue('7');
      setDurationUnit('days');
    }
    // Change 5
    setReminderTimes(
      med.reminderTimes && med.reminderTimes.length > 0
        ? med.reminderTimes
        : [med.reminderTime ?? '08:00']
    );
    setReminderWeekDay(med.reminderDays?.[0] ?? 0);
    setReminderMonthDay(String(med.reminderDays?.[0] ?? 1));
    setDialogVisible(true);
  }

  async function handleSave() {
    if (!nameInput.trim() || !dosageInput.trim()) {
      setError(t('common.required'));
      return;
    }
    const fv = parseInt(frequencyValue, 10) || 1;

    // Change 1: endDate for temporary
    let endDate: Timestamp | undefined;
    if (type === 'temporary') {
      const dv = parseInt(durationValue, 10) || 7;
      const endDateObj = durationUnit === 'weeks' ? addWeeks(new Date(), dv) : addDays(new Date(), dv);
      endDate = Timestamp.fromDate(endDateObj);
    }

    // Change 5: smart reminder fields
    let reminderTimeToSave: string | undefined;
    let reminderTimesToSave: string[] | undefined;
    let reminderDaysToSave: number[] | undefined;
    if (reminderEnabled) {
      if (frequencyUnit === 'daily' && fv > 1) {
        reminderTimesToSave = Array.from({ length: fv }, (_, i) => reminderTimes[i] ?? '08:00');
        reminderTimeToSave = reminderTimesToSave[0];
      } else if (frequencyUnit === 'weekly') {
        reminderDaysToSave = [reminderWeekDay];
        reminderTimeToSave = reminderTime;
      } else if (frequencyUnit === 'monthly') {
        const md = parseInt(reminderMonthDay, 10);
        reminderDaysToSave = [Math.min(Math.max(md, 1), 31)];
        reminderTimeToSave = reminderTime;
      } else {
        reminderTimeToSave = reminderTime;
      }
    }

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
          endDate,
          durationValue: type === 'temporary' ? (parseInt(durationValue, 10) || 7) : undefined,
          durationUnit: type === 'temporary' ? durationUnit : undefined,
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTimeToSave : undefined,
          reminderTimes: reminderEnabled ? reminderTimesToSave : undefined,
          reminderDays: reminderEnabled ? reminderDaysToSave : undefined,
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
          endDate,
          durationValue: type === 'temporary' ? (parseInt(durationValue, 10) || 7) : undefined,
          durationUnit: type === 'temporary' ? durationUnit : undefined,
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTimeToSave : undefined,
          reminderTimes: reminderEnabled ? reminderTimesToSave : undefined,
          reminderDays: reminderEnabled ? reminderDaysToSave : undefined,
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

  function handleDelete(med: Medication) {
    Alert.alert(
      t('medications.deleteConfirm', { name: med.name }),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteRecord(paths.medications(familyId, petId), med.id),
        },
      ]
    );
  }

  function handleToggleActive(med: Medication) {
    updateRecord<Medication>(paths.medications(familyId, petId), med.id, { isActive: !med.isActive });
  }

  function dosageUnitLabel(unit: string) {
    if (unit === 'pill') return t('medications.pill');
    if (unit === 'ml') return t('medications.ml');
    return t('medications.units_dose');
  }

  // Change 5: smart reminder JSX helper
  function renderReminderFields() {
    const fv = parseInt(frequencyValue, 10) || 1;

    if (frequencyUnit === 'daily' && fv > 1) {
      return (
        <>
          {Array.from({ length: fv }, (_, i) => (
            <TextInput
              key={i}
              label={t('medications.reminderTimeN', { n: i + 1 })}
              value={reminderTimes[i] ?? '08:00'}
              onChangeText={(v) => {
                const updated = [...reminderTimes];
                updated[i] = v;
                setReminderTimes(updated);
              }}
              mode="outlined"
              style={styles.input}
              placeholder="08:00"
            />
          ))}
        </>
      );
    }

    if (frequencyUnit === 'weekly') {
      return (
        <>
          <Text style={styles.sectionLabel}>{t('medications.reminderWeekDay')}</Text>
          <Menu
            visible={reminderWeekDayMenuVisible}
            onDismiss={() => setReminderWeekDayMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setReminderWeekDayMenuVisible(true)}
                style={[styles.unitButton, { alignSelf: 'flex-start', marginBottom: 8 }]}
              >
                {t(`medications.${WEEK_DAYS[reminderWeekDay]}`)}
              </Button>
            }
          >
            {WEEK_DAYS.map((day, idx) => (
              <Menu.Item
                key={day}
                title={t(`medications.${day}`)}
                onPress={() => {
                  setReminderWeekDay(idx);
                  setReminderWeekDayMenuVisible(false);
                }}
              />
            ))}
          </Menu>
          <TextInput
            label={t('medications.reminderTimeLabel')}
            value={reminderTime}
            onChangeText={setReminderTime}
            mode="outlined"
            style={styles.input}
            placeholder="08:00"
          />
        </>
      );
    }

    if (frequencyUnit === 'monthly') {
      return (
        <>
          <TextInput
            label={t('medications.reminderMonthDay')}
            value={reminderMonthDay}
            onChangeText={setReminderMonthDay}
            keyboardType="number-pad"
            mode="outlined"
            style={styles.input}
            placeholder="1"
          />
          <TextInput
            label={t('medications.reminderTimeLabel')}
            value={reminderTime}
            onChangeText={setReminderTime}
            mode="outlined"
            style={styles.input}
            placeholder="08:00"
          />
        </>
      );
    }

    return (
      <TextInput
        label={t('medications.reminderTimeLabel')}
        value={reminderTime}
        onChangeText={setReminderTime}
        mode="outlined"
        style={styles.input}
        placeholder="08:00"
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('medications.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {meds.length === 0
            ? <Text style={styles.empty}>{t('medications.noMedications')}</Text>
            : meds.map((m) => (
              <Card key={m.id} style={[styles.card, !m.isActive && styles.inactiveCard]}>
                <Card.Title
                  title={m.name}
                  subtitle={`${m.dosage}${m.dosageUnit ? ' ' + dosageUnitLabel(m.dosageUnit) : ''}`}
                  right={() => (
                    <View style={styles.cardActions}>
                      <Chip compact style={m.type === 'regular' ? styles.regularChip : styles.tempChip}>
                        {t(`medications.${m.type}`)}
                      </Chip>
                      <IconButton
                        icon={m.isActive ? 'toggle-switch' : 'toggle-switch-off'}
                        size={18}
                        iconColor={m.isActive ? Colors.primary : Colors.textSecondary}
                        onPress={() => handleToggleActive(m)}
                      />
                      <IconButton icon="pencil" size={18} onPress={() => openEdit(m)} />
                      <IconButton icon="delete" size={18} iconColor={Colors.danger} onPress={() => handleDelete(m)} />
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

                {/* Change 1: Duration for temporary */}
                {type === 'temporary' && (
                  <View>
                    <Text style={styles.sectionLabel}>{t('medications.duration')}</Text>
                    <View style={styles.dosageRow}>
                      <TextInput
                        label={t('medications.duration')}
                        value={durationValue}
                        onChangeText={setDurationValue}
                        keyboardType="number-pad"
                        mode="outlined"
                        style={styles.dosageInput}
                      />
                      <Menu
                        visible={durationMenuVisible}
                        onDismiss={() => setDurationMenuVisible(false)}
                        anchor={
                          <Button
                            mode="outlined"
                            onPress={() => setDurationMenuVisible(true)}
                            style={styles.unitButton}
                          >
                            {t(`medications.${durationUnit}`)}
                          </Button>
                        }
                      >
                        <Menu.Item
                          title={t('medications.days')}
                          onPress={() => { setDurationUnit('days'); setDurationMenuVisible(false); }}
                        />
                        <Menu.Item
                          title={t('medications.weeks')}
                          onPress={() => { setDurationUnit('weeks'); setDurationMenuVisible(false); }}
                        />
                      </Menu>
                    </View>
                  </View>
                )}

                {/* Change 2: Two-row frequency layout */}
                <Text style={styles.sectionLabel}>{t('medications.frequency')}</Text>
                <SegmentedButtons
                  value={frequencyUnit}
                  onValueChange={(v) => setFrequencyUnit(v as FrequencyUnit)}
                  buttons={[
                    { value: 'daily', label: t('medications.daily') },
                    { value: 'weekly', label: t('medications.weekly') },
                  ]}
                  style={[styles.segment, { marginBottom: 4 }]}
                />
                <SegmentedButtons
                  value={frequencyUnit}
                  onValueChange={(v) => setFrequencyUnit(v as FrequencyUnit)}
                  buttons={[
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
                {/* Change 5: smart reminder fields */}
                {reminderEnabled && renderReminderFields()}

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
  inactiveCard: { opacity: 0.5 },
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
