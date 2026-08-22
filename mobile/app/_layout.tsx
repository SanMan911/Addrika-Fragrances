import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { AppState, View, ActivityIndicator, type AppStateStatus } from 'react-native';
import { SessionContext, useSession, useSessionState } from '../lib/session';
import { CartContext, useCartState } from '../lib/cart';
import { checkForNewOrder } from '../lib/orderWatcher';

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
  useOrderPlacedWatcher();
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
      <Stack.Screen
        name="order-placed"
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}

/**
 * Foreground poll for a NEW B2B order. When the app returns to
 * `active` (after the retailer completes checkout on the web) we
 * ask the backend for the newest order and compare it against the
 * snapshot that `openWebCheckout` wrote right before we left.
 *
 * A "hit" pushes the celebration screen onto the stack with the
 * fresh order metadata as query params — no extra API call from
 * the screen itself.
 *
 * Guarded so we don't fire while sitting on `/login` (no session)
 * or already inside `/order-placed` (would double-navigate).
 */
function useOrderPlacedWatcher() {
  const { session } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const lastAppState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!session || session.kind !== 'retailer') return;

    const onChange = async (next: AppStateStatus) => {
      const prev = lastAppState.current;
      lastAppState.current = next;
      // Only fire on background/inactive → active transitions.
      if (next !== 'active' || (prev !== 'background' && prev !== 'inactive')) {
        return;
      }
      // Don't stack a second celebration on top of the current one.
      if (segments[0] === 'order-placed') return;

      const fresh = await checkForNewOrder(session.token);
      if (!fresh) return;

      router.push({
        pathname: '/order-placed',
        params: {
          order_number: fresh.order_number || fresh.order_id,
          order_id: fresh.order_id,
          grand_total: fresh.grand_total != null ? String(fresh.grand_total) : '',
          items: fresh.items ? String(fresh.items.length) : '',
        },
      });
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [session, router, segments]);
}
