import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PetLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: '' }} />
      <Stack.Screen name="new" options={{ title: t('pets.addPet') }} />
    </Stack>
  );
}
