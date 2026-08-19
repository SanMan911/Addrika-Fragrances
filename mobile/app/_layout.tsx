import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SessionContext, useSessionState } from '../lib/session';
import { CartContext, useCartState } from '../lib/cart';

function useAuthGate() {
  const { session, loading } = useSessionState();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'login';
    if (!session && !inAuth) {
      router.replace('/login');
    } else if (session && inAuth) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  return { session, loading };
}

export default function RootLayout() {
  const sessionState = useSessionState();
  const cartState = useCartState();
  const { loading } = sessionState;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SessionContext.Provider value={sessionState}>
        <CartContext.Provider value={cartState}>
          {loading ? (
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a52' }}
              testID="boot-splash"
            >
              <ActivityIndicator color="#d4af37" size="large" />
            </View>
          ) : (
            <StackNav />
          )}
        </CartContext.Provider>
      </SessionContext.Provider>
    </GestureHandlerRootView>
  );
}

function StackNav() {
  useAuthGate();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1e3a52' },
        headerTintColor: '#d4af37',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#faf7f2' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="products" options={{ title: 'Catalogue' }} />
      <Stack.Screen name="cart" options={{ title: 'Your Cart' }} />
    </Stack>
  );
}
