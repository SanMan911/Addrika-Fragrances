import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { usePad } from '../../lib/pad';

export default function TabsLayout() {
  const { lineCount } = usePad();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.parchment,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.navyLine,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textOnDarkMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stock',
          tabBarTestID: 'tab-stock',
          tabBarIcon: ({ color, size }) => <FontAwesome name="cubes" color={color} size={size - 3} />,
        }}
      />
      <Tabs.Screen
        name="pad"
        options={{
          title: 'Order Pad',
          tabBarTestID: 'tab-pad',
          tabBarBadge: lineCount > 0 ? lineCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.ink, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="clipboard" color={color} size={size - 3} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarTestID: 'tab-orders',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="file-text-o" color={color} size={size - 3} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarTestID: 'tab-more',
          tabBarIcon: ({ color, size }) => <FontAwesome name="bars" color={color} size={size - 3} />,
        }}
      />
    </Tabs>
  );
}
