import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import {
  Text, List, Divider, ActivityIndicator, FAB, Portal, Dialog, Button,
} from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { useDashboard, DashboardTask } from '../../src/hooks/useDashboard';
import { usePets } from '../../src/hooks/usePets';
import { Colors } from '../../src/constants/colors';
import { SPECIES_MAP } from '../../src/constants/species';

function iconForType(type: DashboardTask['type']): string {
  const icons: Record<DashboardTask['type'], string> = {
    medication: 'pill',
    vaccine: 'needle',
    treatment: 'bug',
    appointment: 'calendar-clock',
  };
  return icons[type];
}

export default function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'he' ? heLocale : enUS;
  const { today, upcoming7, overdue, isLoading } = useDashboard();
  const pets = usePets();

  const [addDialogVisible, setAddDialogVisible] = useState(false);

  const isEmpty = !isLoading && today.length === 0 && upcoming7.length === 0 && overdue.length === 0;

  function renderTask(task: DashboardTask) {
    const key = `${task.petId}-${task.type}-${task.scheduledDate.getTime()}`;
    const timeStr = task.timeLabel ? ` • ${task.timeLabel}` : '';
    return (
      <List.Item
        key={key}
        title={`${task.petName} – ${task.label}`}
        description={format(task.scheduledDate, 'dd/MM/yyyy', { locale }) + timeStr}
        left={(props) => <List.Icon {...props} icon={iconForType(task.type)} />}
        onPress={() => router.push(task.route as any)}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
      />
    );
  }

  const sections: { title: string; tasks: DashboardTask[]; color: string }[] = [
    { title: t('reminders.overdue'), tasks: overdue, color: Colors.danger },
    { title: t('reminders.today'), tasks: today, color: Colors.primary },
    { title: t('reminders.upcoming'), tasks: upcoming7, color: Colors.info },
  ];

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>{t('reminders.title')}</Text>

        {isLoading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

        {sections.map((section) =>
          section.tasks.length > 0 ? (
            <View key={section.title}>
              <List.Subheader style={[styles.subheader, { color: section.color }]}>
                {section.title}
              </List.Subheader>
              {section.tasks.map(renderTask)}
              <Divider />
            </View>
          ) : null
        )}

        {isEmpty && (
          <Text style={styles.empty}>{t('reminders.noReminders')}</Text>
        )}
      </ScrollView>

      {/* FAB — add a reminder for any pet */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setAddDialogVisible(true)}
      />

      {/* Pet selection dialog */}
      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={() => setAddDialogVisible(false)}>
          <Dialog.Title>{t('reminders.addReminder')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              {pets.length === 0 ? (
                <Text style={styles.noPets}>{t('pets.noPets')}</Text>
              ) : (
                pets.map((pet) => (
                  <View key={pet.id} style={styles.petRow}>
                    <Text style={styles.petName}>
                      {SPECIES_MAP[pet.species]?.emoji ?? '🐾'} {pet.name}
                    </Text>
                    <View style={styles.petButtons}>
                      <Button
                        compact
                        mode="outlined"
                        icon="pill"
                        style={styles.petBtn}
                        onPress={() => {
                          setAddDialogVisible(false);
                          router.push(`/pet/${pet.id}/medications` as any);
                        }}
                      >
                        {t('reminders.addMedication')}
                      </Button>
                      <Button
                        compact
                        mode="outlined"
                        icon="calendar-plus"
                        style={styles.petBtn}
                        onPress={() => {
                          setAddDialogVisible(false);
                          router.push(`/pet/${pet.id}/appointments` as any);
                        }}
                      >
                        {t('reminders.addAppointment')}
                      </Button>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddDialogVisible(false)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  title: { padding: 16, paddingBottom: 8 },
  loader: { marginTop: 40 },
  subheader: { fontWeight: '600' },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 60, fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: Colors.primary },
  dialogScroll: { maxHeight: 360 },
  petRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  petName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  petButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  petBtn: { borderColor: Colors.primary },
  noPets: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 20 },
});
