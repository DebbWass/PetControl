import { Alert } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { markTreatmentDone, dismissTreatmentDue } from '../services/treatments';
import { Colors } from '../constants/colors';
import type { DashboardTask } from '../hooks/useDashboard';

interface Props {
  task: DashboardTask;
  onChanged: () => void;
}

/** "Done" / "Not done" buttons for a treatment task on the dashboard and reminders tab. */
export function TreatmentTaskActions({ task, onChanged }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const tr = task.treatment;
  if (!tr || !user?.familyId) return null;
  const familyId = user.familyId;

  function confirmDone() {
    Alert.alert(
      t('treatments.markDoneTitle'),
      t('treatments.markDoneMessage', { name: tr!.productName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('treatments.done'),
          onPress: async () => {
            try {
              await markTreatmentDone(familyId, tr!, user!.uid);
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message);
            }
            onChanged();
          },
        },
      ]
    );
  }

  function confirmNotDone() {
    Alert.alert(
      t('treatments.notDoneTitle'),
      t('treatments.notDoneMessage', { name: tr!.productName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('treatments.notDone'),
          style: 'destructive',
          onPress: async () => {
            try {
              await dismissTreatmentDue(familyId, tr!);
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message);
            }
            onChanged();
          },
        },
      ]
    );
  }

  return (
    <>
      <IconButton
        icon="check-circle-outline"
        iconColor={Colors.success}
        size={22}
        onPress={confirmDone}
        accessibilityLabel={t('treatments.done')}
      />
      <IconButton
        icon="close-circle-outline"
        iconColor={Colors.danger}
        size={22}
        onPress={confirmNotDone}
        accessibilityLabel={t('treatments.notDone')}
      />
    </>
  );
}
