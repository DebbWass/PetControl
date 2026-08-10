import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy } from 'firebase/firestore';
import { format, parse, isValid } from 'date-fns';
import { DateTimeInput } from '../../../src/components/DateTimeInput';
import {
  subscribeToCollection, addRecord, updateRecord, paths,
} from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Appointment } from '../../../src/types';
import { formatDateTime } from '../../../src/utils/dateUtils';

function defaultDateStr(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return format(d, 'dd/MM/yyyy');
}

function parseAppointmentDate(dateStr: string, timeStr: string): Date | null {
  const parsed = parse(dateStr.trim(), 'dd/MM/yyyy', new Date());
  if (!isValid(parsed)) return null;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] ?? '10', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return null;
  parsed.setHours(h, m, 0, 0);
  return parsed;
}

export default function AppointmentsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [apts, setApts] = useState<Appointment[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);

  // Form fields
  const [titleInput, setTitleInput] = useState('');
  const [vetInput, setVetInput] = useState('');
  const [clinicInput, setClinicInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('10:00');
  const [notesInput, setNotesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!familyId || !petId) return;
    return subscribeToCollection<Appointment>(
      paths.appointments(familyId, petId),
      [orderBy('scheduledDate', 'asc')],
      setApts
    );
  }, [familyId, petId]);

  function reset() {
    setEditingApt(null);
    setTitleInput('');
    setVetInput('');
    setClinicInput('');
    setDateInput(defaultDateStr());
    setTimeInput('10:00');
    setNotesInput('');
    setError('');
  }

  function openAdd() {
    reset();
    setDialogVisible(true);
  }

  function openEdit(apt: Appointment) {
    setEditingApt(apt);
    setTitleInput(apt.title);
    setVetInput(apt.veterinarian ?? '');
    setClinicInput(apt.clinic ?? '');
    const d = apt.scheduledDate?.toDate();
    setDateInput(d ? format(d, 'dd/MM/yyyy') : defaultDateStr());
    setTimeInput(d ? format(d, 'HH:mm') : '10:00');
    setNotesInput(apt.notes ?? '');
    setError('');
    setDialogVisible(true);
  }

  async function handleSave() {
    if (!titleInput.trim()) { setError(t('common.missingFields', { fields: t('appointments.titleField') })); return; }
    const parsedDate = parseAppointmentDate(dateInput, timeInput);
    if (!parsedDate) { setError(t('appointments.invalidDate')); return; }

    setLoading(true);
    try {
      const scheduledDate = Timestamp.fromDate(parsedDate);
      if (editingApt) {
        await updateRecord<Appointment>(paths.appointments(familyId, petId), editingApt.id, {
          title: titleInput.trim(),
          veterinarian: vetInput.trim() || undefined,
          clinic: clinicInput.trim() || undefined,
          scheduledDate,
          notes: notesInput.trim() || undefined,
        });
      } else {
        await addRecord<Appointment>(paths.appointments(familyId, petId), {
          petId, familyId,
          title: titleInput.trim(),
          veterinarian: vetInput.trim() || undefined,
          clinic: clinicInput.trim() || undefined,
          scheduledDate,
          status: 'scheduled',
          reminderEnabled: true,
          reminderMinutesBefore: 1440,
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

  function statusColor(status: Appointment['status']): string {
    if (status === 'completed') return Colors.success;
    if (status === 'cancelled') return Colors.danger;
    return Colors.info;
  }

  return (
    <>
      <Stack.Screen options={{ title: t('appointments.title') }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {apts.length === 0
            ? <Text style={styles.empty}>{t('appointments.noAppointments')}</Text>
            : apts.map((a) => (
              <Card key={a.id} style={styles.card}>
                <Card.Title
                  title={a.title}
                  subtitle={`${formatDateTime(a.scheduledDate)}${a.veterinarian ? ` · ${a.veterinarian}` : ''}`}
                  right={() => (
                    <View style={styles.cardRight}>
                      <Chip compact style={[styles.chip, { backgroundColor: statusColor(a.status) + '22' }]}>
                        {t(`appointments.${a.status}`)}
                      </Chip>
                      {a.status === 'scheduled' && (
                        <IconButton icon="pencil" size={18} onPress={() => openEdit(a)} />
                      )}
                    </View>
                  )}
                />
                {a.notes ? (
                  <Card.Content>
                    <Text style={styles.notes}>{a.notes}</Text>
                  </Card.Content>
                ) : null}
                {a.status === 'scheduled' && (
                  <Card.Actions>
                    <Button
                      compact
                      textColor={Colors.success}
                      onPress={() => updateRecord<Appointment>(paths.appointments(familyId, petId), a.id, { status: 'completed' })}
                    >
                      {t('appointments.markCompleted')}
                    </Button>
                    <Button
                      compact
                      textColor={Colors.danger}
                      onPress={() => updateRecord<Appointment>(paths.appointments(familyId, petId), a.id, { status: 'cancelled' })}
                    >
                      {t('appointments.cancel')}
                    </Button>
                  </Card.Actions>
                )}
              </Card>
            ))
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={openAdd} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingApt ? t('common.edit') : t('appointments.add')}</Dialog.Title>
            <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : 'height'}>
            <Dialog.ScrollArea style={styles.scrollArea}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TextInput
                  label={t('appointments.titleField')}
                  value={titleInput}
                  onChangeText={setTitleInput}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={`${t('appointments.veterinarian')} (${t('common.optional')})`}
                  value={vetInput}
                  onChangeText={setVetInput}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={`${t('appointments.clinic')} (${t('common.optional')})`}
                  value={clinicInput}
                  onChangeText={setClinicInput}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Date & Time row */}
                <View style={styles.dateTimeRow}>
                  <DateTimeInput
                    label={t('appointments.dateOnly')}
                    value={dateInput}
                    onChange={setDateInput}
                    mode="date"
                    style={styles.dateInput}
                  />
                  <DateTimeInput
                    label={t('appointments.timeOnly')}
                    value={timeInput}
                    onChange={setTimeInput}
                    mode="time"
                    style={styles.timeInput}
                  />
                </View>

                <TextInput
                  label={`${t('appointments.notes')} (${t('common.optional')})`}
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
  card: { marginBottom: 8 },
  cardRight: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  scrollArea: { maxHeight: 460 },
  chip: { marginRight: 4 },
  notes: { color: Colors.textSecondary, fontSize: 13 },
  dateTimeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateInput: { flex: 3 },
  timeInput: { flex: 2 },
});
