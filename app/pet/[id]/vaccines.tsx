import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, FAB, Card, Chip, Button, TextInput, HelperText,
  Dialog, Portal, Menu, Switch, List, IconButton,
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
import { Vaccine } from '../../../src/types';
import { formatDate, toTimestamp } from '../../../src/utils/dateUtils';
import { COMMON_VACCINES, CommonVaccine } from '../../../src/constants/vaccines';
import { calcVaccineNextDue } from '../../../src/utils/medicationUtils';
import { DateTimeInput } from '../../../src/components/DateTimeInput';

function todayStr(): string {
  return format(new Date(), 'dd/MM/yyyy');
}

function parseDateStr(s: string): Date | null {
  const d = parse(s.trim(), 'dd/MM/yyyy', new Date());
  return isValid(d) ? d : null;
}

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
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);

  // Form state
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState<CommonVaccine>(COMMON_VACCINES[0]);
  const [customName, setCustomName] = useState('');
  const [vaccineDateInput, setVaccineDateInput] = useState(todayStr());
  const [manualNextDue, setManualNextDue] = useState('');
  const [useAutoNextDue, setUseAutoNextDue] = useState(true);
  const [vetInput, setVetInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
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
    setEditingVaccine(null);
    setSelectedVaccine(COMMON_VACCINES[0]);
    setCustomName('');
    setVaccineDateInput(todayStr());
    setManualNextDue('');
    setUseAutoNextDue(true);
    setVetInput('');
    setNotesInput('');
    setError('');
  }

  function openAdd() {
    reset();
    setDialogVisible(true);
  }

  function openEdit(v: Vaccine) {
    setEditingVaccine(v);
    // Try to match existing vaccine name to a known vaccine
    const known = COMMON_VACCINES.find(
      (cv) => cv.nameHe === v.name || cv.nameEn === v.name
    );
    if (known) {
      setSelectedVaccine(known);
      setCustomName('');
    } else {
      setSelectedVaccine(COMMON_VACCINES[COMMON_VACCINES.length - 1]); // "Other"
      setCustomName(v.name);
    }
    const vDate = v.vaccinationDate?.toDate();
    setVaccineDateInput(vDate ? format(vDate, 'dd/MM/yyyy') : todayStr());
    const nDate = v.nextDueDate?.toDate();
    setManualNextDue(nDate ? format(nDate, 'dd/MM/yyyy') : '');
    setUseAutoNextDue(!nDate); // if there was a next due, use manual
    setVetInput(v.veterinarian ?? '');
    setNotesInput(v.notes ?? '');
    setError('');
    setDialogVisible(true);
  }

  function confirmDelete(v: Vaccine) {
    Alert.alert(
      t('common.delete'),
      v.name,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteRecord(paths.vaccines(familyId, petId), v.id),
        },
      ]
    );
  }

  async function handleSave() {
    const vaccineName = isOther
      ? customName.trim()
      : (i18n.language === 'he' ? selectedVaccine.nameHe : selectedVaccine.nameEn);

    if (!vaccineName) { setError(t('common.missingFields', { fields: t('vaccines.customName') })); return; }

    const vaccDate = parseDateStr(vaccineDateInput);
    if (!vaccDate) { setError(t('appointments.invalidDate')); return; }

    let nextDue: Date | null = null;
    if (!isOther && useAutoNextDue && selectedVaccine.intervalDays > 0) {
      nextDue = calcVaccineNextDue(vaccDate, selectedVaccine.intervalDays);
    } else if (manualNextDue.trim()) {
      const parsed = parseDateStr(manualNextDue);
      if (!parsed) { setError(t('vaccines.manualNextDue')); return; }
      nextDue = parsed;
    }

    setLoading(true);
    try {
      if (editingVaccine) {
        await updateRecord<Vaccine>(paths.vaccines(familyId, petId), editingVaccine.id, {
          name: vaccineName,
          vaccinationDate: Timestamp.fromDate(vaccDate),
          nextDueDate: nextDue ? toTimestamp(nextDue) : undefined,
          veterinarian: vetInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
        });
      } else {
        await addRecord<Vaccine>(paths.vaccines(familyId, petId), {
          petId,
          familyId,
          name: vaccineName,
          vaccinationDate: Timestamp.fromDate(vaccDate),
          nextDueDate: nextDue ? toTimestamp(nextDue) : undefined,
          veterinarian: vetInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
          reminderEnabled: true,
          reminderDaysBeforeDue: 30,
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
                    subtitle={`${t('vaccines.date')}: ${formatDate(v.vaccinationDate)}${v.veterinarian ? ` · ${v.veterinarian}` : ''}`}
                    right={() => (
                      <View style={styles.cardRight}>
                        {v.nextDueDate && (
                          <Chip
                            compact
                            style={[styles.chip, { backgroundColor: statusColor(days) + '22' }]}
                            textStyle={{ color: statusColor(days) }}
                          >
                            {days !== null && days < 0
                              ? t('reminders.overdue')
                              : formatDate(v.nextDueDate)}
                          </Chip>
                        )}
                        <IconButton icon="pencil" size={18} onPress={() => openEdit(v)} />
                        <IconButton
                          icon="delete"
                          size={18}
                          iconColor={Colors.danger}
                          onPress={() => confirmDelete(v)}
                        />
                      </View>
                    )}
                  />
                  {v.nextDueDate && (
                    <Card.Content>
                      <Text style={styles.nextDueText}>
                        {t('vaccines.nextDue')}: {formatDate(v.nextDueDate)}
                        {days !== null ? ` (${Math.abs(days)} ${days < 0 ? t('vaccines.daysAgo') : t('vaccines.daysLeft')})` : ''}
                      </Text>
                    </Card.Content>
                  )}
                  {v.notes ? (
                    <Card.Content>
                      <Text style={styles.notes}>{v.notes}</Text>
                    </Card.Content>
                  ) : null}
                </Card>
              );
            })
          }
        </ScrollView>

        <FAB icon="plus" style={styles.fab} onPress={openAdd} />

        <Portal>
          <Dialog visible={dialogVisible} onDismiss={() => { setDialogVisible(false); reset(); }}>
            <Dialog.Title>{editingVaccine ? t('common.edit') : t('vaccines.add')}</Dialog.Title>
            <Dialog.ScrollArea style={styles.scrollArea}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {/* Vaccine selector */}
                {!editingVaccine && (
                  <>
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
                      {COMMON_VACCINES.map((cv) => (
                        <Menu.Item
                          key={cv.nameEn}
                          title={i18n.language === 'he' ? cv.nameHe : cv.nameEn}
                          onPress={() => {
                            setSelectedVaccine(cv);
                            setMenuVisible(false);
                            setUseAutoNextDue(cv.intervalDays > 0);
                          }}
                        />
                      ))}
                    </Menu>
                  </>
                )}

                {isOther && (
                  <TextInput
                    label={t('vaccines.customName')}
                    value={customName}
                    onChangeText={setCustomName}
                    mode="outlined"
                    style={styles.input}
                  />
                )}

                {/* Vaccination date */}
                <DateTimeInput
                  label={t('vaccines.date')}
                  value={vaccineDateInput}
                  onChange={setVaccineDateInput}
                  mode="date"
                />

                {/* Veterinarian */}
                <TextInput
                  label={`${t('vaccines.veterinarian')} (${t('common.optional')})`}
                  value={vetInput}
                  onChangeText={setVetInput}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Notes */}
                <TextInput
                  label={`${t('common.notes')} (${t('common.optional')})`}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />

                {/* Next due section */}
                {!isOther && selectedVaccine.intervalDays > 0 && (
                  <List.Item
                    title={t('vaccines.autoNextDue')}
                    right={() => (
                      <Switch
                        value={useAutoNextDue}
                        onValueChange={setUseAutoNextDue}
                        color={Colors.primary}
                      />
                    )}
                  />
                )}

                {(isOther || !useAutoNextDue) && (
                  <DateTimeInput
                    label={t('vaccines.manualNextDue')}
                    value={manualNextDue}
                    onChange={setManualNextDue}
                    mode="date"
                    optional
                  />
                )}

                {error ? <HelperText type="error">{error}</HelperText> : null}
              </ScrollView>
            </Dialog.ScrollArea>
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
  chip: { marginRight: 4 },
  label: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  menuButton: { marginBottom: 12 },
  scrollArea: { maxHeight: 520 },
  nextDueText: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  notes: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
});
