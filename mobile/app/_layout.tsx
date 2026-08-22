import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SessionContext, useSession, useSessionState, type SessionContextValue } from '../lib/session';
import { CartContext, useCartState } from '../lib/cart';

/**
 * Reads the ONE session from the provider — never creates its own.
 * (An earlier version called `useSessionState()` here, which spawned a
 * second state tree independent of the provider. The result: successful
 * logins persisted to SecureStore but the router never redirected
 * because the gate was watching a different `session` value. Reopening
 * the app made the gate's own load-persisted read the stored session
 * on boot and the redirect worked — hence the "correct credentials do
 * nothing until you force-close" symptom.)
 */
function useAuthGate() {
  const { session, loading } = useSession();
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
