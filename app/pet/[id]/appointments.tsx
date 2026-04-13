import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, FAB, Card, Chip, Button, TextInput, HelperText, Dialog, Portal } from 'react-native-paper';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Timestamp, orderBy, where } from 'firebase/firestore';
import { subscribeToCollection, addRecord, updateRecord, paths } from '../../../src/services/firebase/firestore';
import { useAuthStore } from '../../../src/store/authStore';
import { Colors } from '../../../src/constants/colors';
import { Appointment } from '../../../src/types';
import { formatDateTime } from '../../../src/utils/dateUtils';

export default function AppointmentsScreen() {
  const { id: petId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const familyId = user?.familyId ?? '';

  const [apts, setApts] = useState<Appointment[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [vetInput, setVetInput] = useState('');
  const [clinicInput, setClinicInput] = useState('');
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

  function reset() { setTitleInput(''); setVetInput(''); setClinicInput(''); setError(''); }

  async function handleAdd() {
    if (!titleInput.trim()) { setError(t('common.required')); return; }
    setLoading(true);
    try {
      const scheduled = new Date();
      scheduled.setDate(scheduled.getDate() + 7); // default: 1 week from now

      await addRecord<Appointment>(paths.appointments(familyId, petId), {
        petId, familyId,
        title: titleInput.trim(),
        veterinarian: vetInput.trim() || undefined,
        clinic: clinicInput.trim() || undefined,
        scheduledDate: Timestamp.fromDate(scheduled),
        status: 'scheduled',
        reminderEnabled: true,
        reminderMinutesBefore: 1440,
        createdBy: user!.uid,
      });
      setDialogVisible(false); reset();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
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
                    <Chip compact style={[styles.chip, { backgroundColor: statusColor(a.status) + '22' }]}>
                      {t(`appointments.${a.status}`)}
                    </Chip>
                  )}
                />
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

        <FAB icon="plus" style={styles.fab} onPress={() => setDialogVisible(true)} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{t('appointments.add')}</Dialog.Title>
            <Dialog.Content>
              <TextInput label={t('appointments.titleField')} value={titleInput} onChangeText={setTitleInput} mode="outlined" style={styles.input} />
              <TextInput label={`${t('appointments.veterinarian')} (${t('common.optional')})`} value={vetInput} onChangeText={setVetInput} mode="outlined" style={styles.input} />
              <TextInput label={`${t('appointments.clinic')} (${t('common.optional')})`} value={clinicInput} onChangeText={setClinicInput} mode="outlined" style={styles.input} />
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
  card: { marginBottom: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  input: { marginBottom: 8 },
  chip: { marginRight: 8 },
});
