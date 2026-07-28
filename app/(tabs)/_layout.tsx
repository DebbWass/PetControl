import { Platform, View, Image, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';

function WebHeader() {
  return (
    <View style={styles.webHeader}>
      <MaterialCommunityIcons name="paw" size={32} color={Colors.primary} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        headerShown: isWeb,
        headerTitle: () => <WebHeader />,
        headerStyle: isWeb ? styles.webHeaderBar : undefined,
        tabBarStyle: isWeb ? styles.webTabBar : undefined,
        tabBarItemStyle: isWeb ? styles.webTabItem : undefined,
        tabBarLabelStyle: isWeb ? styles.webTabLabel : undefined,
        tabBarIconStyle: isWeb ? styles.webTabIcon : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={isWeb ? 28 : size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: t('tabs.pets'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="paw" color={color} size={isWeb ? 28 : size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t('tabs.reminders'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell" color={color} size={isWeb ? 28 : size} />
          ),
        }}
      />
      {/* AI assistant is temporarily hidden from the UI. The screen and all its
          logic remain in ai.tsx — to bring the tab back, remove `href: null`. */}
      <Tabs.Screen
        name="ai"
        options={{
          href: null,
          title: t('tabs.ai'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="robot" color={color} size={isWeb ? 28 : size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={isWeb ? 28 : size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  webHeaderBar: {
    height: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  webTabBar: {
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  webTabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  webTabIcon: {
    marginBottom: 2,
  },
});
