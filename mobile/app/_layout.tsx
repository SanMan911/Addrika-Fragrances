import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1e3a52' },
          headerTintColor: '#d4af37',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#faf7f2' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Addrika' }} />
        <Stack.Screen name="products" options={{ title: 'Products' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
