import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, SegmentedButtons, Switch, List, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { format, parse, isValid } from 'date-fns';
import {
  subscribeToCollection, addRecord, updateRecord, deleteRecord, paths,
} from '../../../src/services/firebase/firestore';
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
  const days = category === 'deworming' ? 90 : 30;
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
  const [otherTypeInput, setOtherTypeInput] = useState('');
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
    setOtherTypeInput('');
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

  function handleCategoryChange(cat: TreatmentCategory) {
    setCategory(cat);
    setNextCategory(cat);
    setNextDueDateInput(defaultNextDate(cat));
  }

  function openEdit(tr: Treatment) {
    setEditingTreatment(tr);
    setProduct(tr.productName);
    setCategory(tr.category);
    setOtherTypeInput(tr.otherType ?? '');
    setTreatmentDateInput(format(tr.treatmentDate.toDate(), 'dd/MM/yyyy'));
    setDosageInput(tr.dosage ?? '');
    setNotesInput(tr.notes ?? '');
    setHasNextTreatment(!!tr.nextDueDate);
    setNextCategory(tr.category);
    setNextDueDateInput(
      tr.nextDueDate
        ? format(tr.nextDueDate.toDate(), 'dd/MM/yyyy')
        : defaultNextDate(tr.category)
    );
    setReminderEnabled(tr.reminderEnabled);
    setReminderDays(String(tr.reminderDaysBeforeDue));
    setError('');
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
          onPress: () => deleteRecord(paths.treatments(familyId, petId), tr.id),
        },
      ]
    );
  }

  async function handleSave() {
    if (!product.trim()) { setError(t('common.required')); return; }

    const treatmentDate = parseDateStr(treatmentDateInput);
    if (!treatmentDate) { setError(t('appointments.invalidDate')); return; }

    let nextDueTimestamp: Timestamp | undefined;
    if (hasNextTreatment) {
      const nextDate = parseDateStr(nextDueDateInput);
      if (!nextDate) { setError(t('appointments.invalidDate')); return; }
      nextDueTimestamp = Timestamp.fromDate(nextDate);
    }

    const payload = {
      category,
      productName: product.trim(),
      otherType: category === 'other' ? (otherTypeInput.trim() || undefined) : undefined,
      treatmentDate: Timestamp.fromDate(treatmentDate),
      nextDueDate: nextDueTimestamp,
      dosage: dosageInput.trim() || undefined,
      notes: notesInput.trim() || undefined,
      reminderEnabled: hasNextTreatment && reminderEnabled,
      reminderDaysBeforeDue: hasNextTreatment && reminderEnabled ? (parseInt(reminderDays, 10) || 7) : 7,
    };

    setLoading(true);
    try {
      if (editingTreatment) {
        await updateRecord<Treatment>(paths.treatments(familyId, petId), editingTreatment.id, payload);
      } else {
        await addRecord<Treatment>(paths.treatments(familyId, petId), {
          petId,
          familyId,
          ...payload,
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

  function categoryLabel(tr: Treatment): string {
    if (tr.category === 'other' && tr.otherType) return tr.otherType;
    return t(`treatments.${tr.category}`);
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
                  right={() => (
                    <View style={styles.cardActions}>
                      <Chip compact style={styles.chip}>{categoryLabel(tr)}</Chip>
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
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={() => { reset(); setDialogVisible(true); }} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingTreatment ? t('common.edit') : t('treatments.add')}</Dialog.Title>
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

                {/* Custom type when "Other" is selected */}
                {category === 'other' && (
                  <TextInput
                    label={t('treatments.otherType')}
                    value={otherTypeInput}
                    onChangeText={setOtherTypeInput}
                    mode="outlined"
                    style={styles.input}
                  />
                )}

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
  cardActions: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  segment: { marginBottom: 12 },
  chip: { marginRight: 4, backgroundColor: Colors.primaryLight },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6, marginTop: 4 },
  subText: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  scrollArea: { maxHeight: 500 },
});
