import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons, Switch, List, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy, deleteField } from 'firebase/firestore';
import { format, parse, isValid } from 'date-fns';
import {
  subscribeToCollection, addRecord, updateRecord, deleteRecord, paths,
} from '../../../src/services/firebase/firestore';
import {
  markTreatmentDone, dismissTreatmentDue, defaultIntervalDays,
} from '../../../src/services/treatments';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Treatment, TreatmentCategory } from '../../../src/types';
import { formatDate } from '../../../src/utils/dateUtils';
import { DateTimeInput } from '../../../src/components/DateTimeInput';

function todayStr(): string {
  return format(new Date(), 'dd/MM/yyyy');
}

function parseDateStr(s: string): Date | null {
  const d = parse(s.trim(), 'dd/MM/yyyy', new Date());
  return isValid(d) ? d : null;
}

function defaultNextDate(category: TreatmentCategory): string {
  const days = defaultIntervalDays(category);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, 'dd/MM/yyyy');
}

export default function TreatmentsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);

  // Form fields
  const [product, setProduct] = useState('');
  const [category, setCategory] = useState<TreatmentCategory>('flea_tick');
  const [treatmentDateInput, setTreatmentDateInput] = useState(todayStr());
  const [dosageInput, setDosageInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  // Next treatment
  const [hasNextTreatment, setHasNextTreatment] = useState(true);
  const [nextCategory, setNextCategory] = useState<TreatmentCategory>('flea_tick');
  const [nextDueDateInput, setNextDueDateInput] = useState(defaultNextDate('flea_tick'));

  // Reminder
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState('7');

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

  function reset() {
    setEditingTreatment(null);
    setProduct('');
    setCategory('flea_tick');
    setTreatmentDateInput(todayStr());
    setDosageInput('');
    setNotesInput('');
    setHasNextTreatment(true);
    setNextCategory('flea_tick');
    setNextDueDateInput(defaultNextDate('flea_tick'));
    setReminderEnabled(true);
    setReminderDays('7');
    setError('');
  }

  function openEdit(tr: Treatment) {
    reset();
    setEditingTreatment(tr);
    setProduct(tr.productName);
    setCategory(tr.category);
    setNextCategory(tr.category);
    setTreatmentDateInput(format(tr.treatmentDate.toDate(), 'dd/MM/yyyy'));
    setDosageInput(tr.dosage ?? '');
    setNotesInput(tr.notes ?? '');
    setHasNextTreatment(!!tr.nextDueDate);
    setNextDueDateInput(
      tr.nextDueDate ? format(tr.nextDueDate.toDate(), 'dd/MM/yyyy') : defaultNextDate(tr.category)
    );
    setReminderEnabled(tr.nextDueDate ? tr.reminderEnabled : true);
    setReminderDays(String(tr.reminderDaysBeforeDue ?? 7));
    setDialogVisible(true);
  }

  function handleDelete(tr: Treatment) {
    Alert.alert(
      t('treatments.deleteConfirm', { name: tr.productName }),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteRecord(paths.treatments(familyId, petId), tr.id).catch((e) =>
              Alert.alert(t('common.error'), e?.message)
            );
          },
        },
      ]
    );
  }

  function handleMarkDone(tr: Treatment) {
    Alert.alert(
      t('treatments.markDoneTitle'),
      t('treatments.markDoneMessage', { name: tr.productName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('treatments.done'),
          onPress: () => {
            markTreatmentDone(familyId, tr, user!.uid).catch((e) =>
              Alert.alert(t('common.error'), e?.message)
            );
          },
        },
      ]
    );
  }

  function handleNotDone(tr: Treatment) {
    Alert.alert(
      t('treatments.notDoneTitle'),
      t('treatments.notDoneMessage', { name: tr.productName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('treatments.notDone'),
          style: 'destructive',
          onPress: () => {
            dismissTreatmentDue(familyId, tr).catch((e) =>
              Alert.alert(t('common.error'), e?.message)
            );
          },
        },
      ]
    );
  }

  // When category changes, suggest a new next-due date (new records only —
  // editing must not silently move an existing due date)
  function handleCategoryChange(cat: TreatmentCategory) {
    setCategory(cat);
    setNextCategory(cat);
    if (!editingTreatment) setNextDueDateInput(defaultNextDate(cat));
  }

  async function handleSave() {
    if (!product.trim()) { setError(t('common.missingFields', { fields: t('treatments.product') })); return; }

    const treatmentDate = parseDateStr(treatmentDateInput);
    if (!treatmentDate) { setError(t('appointments.invalidDate')); return; }

    let nextDueTimestamp: Timestamp | undefined;
    if (hasNextTreatment) {
      const nextDate = parseDateStr(nextDueDateInput);
      if (!nextDate) { setError(t('appointments.invalidDate')); return; }
      nextDueTimestamp = Timestamp.fromDate(nextDate);
    }

    setLoading(true);
    try {
      const fields = {
        category,
        productName: product.trim(),
        treatmentDate: Timestamp.fromDate(treatmentDate),
        reminderEnabled: hasNextTreatment && reminderEnabled,
        reminderDaysBeforeDue: hasNextTreatment && reminderEnabled ? (parseInt(reminderDays, 10) || 7) : 7,
      };
      if (editingTreatment) {
        // Cleared optional fields must be removed explicitly — updateRecord drops undefined
        await updateRecord<Treatment>(paths.treatments(familyId, petId), editingTreatment.id, {
          ...fields,
          nextDueDate: nextDueTimestamp ?? deleteField(),
          dosage: dosageInput.trim() || deleteField(),
          notes: notesInput.trim() || deleteField(),
        } as unknown as Partial<Treatment>);
      } else {
        await addRecord<Treatment>(paths.treatments(familyId, petId), {
          ...fields,
          petId,
          familyId,
          nextDueDate: nextDueTimestamp,
          dosage: dosageInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
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
                  subtitle={`${formatDate(tr.treatmentDate)}${tr.nextDueDate ? ` → ${t('treatments.nextDue')}: ${formatDate(tr.nextDueDate)}` : ''}`}
                  subtitleNumberOfLines={2}
                  right={() => (
                    <View style={styles.cardActions}>
                      <Chip compact style={styles.chip}>{t(`treatments.${tr.category}`)}</Chip>
                      <IconButton icon="pencil" size={18} onPress={() => openEdit(tr)} />
                      <IconButton icon="delete" size={18} iconColor={Colors.danger} onPress={() => handleDelete(tr)} />
                    </View>
                  )}
                />
                {(tr.dosage || tr.notes) ? (
                  <Card.Content>
                    {tr.dosage ? <Text style={styles.subText}>{t('treatments.dosage')}: {tr.dosage}</Text> : null}
                    {tr.notes ? <Text style={styles.subText}>{tr.notes}</Text> : null}
                  </Card.Content>
                ) : null}
                {tr.nextDueDate ? (
                  <Card.Actions>
                    <Button
                      icon="close-circle-outline"
                      textColor={Colors.danger}
                      onPress={() => handleNotDone(tr)}
                    >
                      {t('treatments.notDone')}
                    </Button>
                    <Button
                      icon="check-circle-outline"
                      mode="contained"
                      buttonColor={Colors.success}
                      onPress={() => handleMarkDone(tr)}
                    >
                      {t('treatments.done')}
                    </Button>
                  </Card.Actions>
                ) : null}
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => { reset(); setDialogVisible(true); }} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingTreatment ? t('treatments.edit') : t('treatments.add')}</Dialog.Title>
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
            <Dialog.ScrollArea style={styles.scrollArea}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {/* Category */}
                <Text style={styles.sectionLabel}>{t('treatments.category')}</Text>
                <SegmentedButtons
                  value={category}
                  onValueChange={(v) => handleCategoryChange(v as TreatmentCategory)}
                  buttons={[
                    { value: 'flea_tick', label: t('treatments.flea_tick') },
                    { value: 'deworming', label: t('treatments.deworming') },
                    { value: 'other', label: t('treatments.other') },
                  ]}
                  style={styles.segment}
                />

                {/* Product */}
                <TextInput
                  label={t('treatments.product')}
                  value={product}
                  onChangeText={setProduct}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Treatment date */}
                <DateTimeInput
                  label={t('treatments.date')}
                  value={treatmentDateInput}
                  onChange={setTreatmentDateInput}
                  mode="date"
                />

                {/* Dosage (optional) */}
                <TextInput
                  label={`${t('treatments.dosage')} (${t('common.optional')})`}
                  value={dosageInput}
                  onChangeText={setDosageInput}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Notes (optional) */}
                <TextInput
                  label={`${t('common.notes')} (${t('common.optional')})`}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />

                {/* Next treatment section */}
                <List.Item
                  title={t('treatments.hasNextTreatment')}
                  right={() => (
                    <Switch
                      value={hasNextTreatment}
                      onValueChange={setHasNextTreatment}
                      color={Colors.primary}
                    />
                  )}
                />

                {hasNextTreatment && (
                  <>
                    <Text style={styles.sectionLabel}>{t('treatments.nextCategory')}</Text>
                    <SegmentedButtons
                      value={nextCategory}
                      onValueChange={(v) => setNextCategory(v as TreatmentCategory)}
                      buttons={[
                        { value: 'flea_tick', label: t('treatments.flea_tick') },
                        { value: 'deworming', label: t('treatments.deworming') },
                        { value: 'other', label: t('treatments.other') },
                      ]}
                      style={styles.segment}
                    />

                    <DateTimeInput
                      label={t('treatments.nextDue')}
                      value={nextDueDateInput}
                      onChange={setNextDueDateInput}
                      mode="date"
                    />

                    {/* Reminder */}
                    <List.Item
                      title={t('treatments.reminderEnabled')}
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
                        label={t('treatments.reminderDays')}
                        value={reminderDays}
                        onChangeText={setReminderDays}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                    )}
                  </>
                )}

                {error ? <HelperText type="error">{error}</HelperText> : null}
              </ScrollView>
            </Dialog.ScrollArea>
            </KeyboardAvoidingView>
            <Dialog.Actions>
              <Button onPress={() => { setDialogVisible(false); reset(); }}>{t('common.cancel')}</Button>
              <Button onPress={handleSave} loading={loading} textColor={Colors.primary}>{t('common.save')}</Button>
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
  chip: { backgroundColor: Colors.primaryLight },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 4 },
  subText: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  scrollArea: { maxHeight: 500 },
});
