import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthContext, useAuth, useAuthState } from '../lib/auth';
import { PadContext, usePadState } from '../lib/pad';
import { colors } from '../lib/theme';

/**
 * Redirects between the login screen and the app shell.
 *
 * Two things this has to get right:
 *  1. It reads the ONE session from the provider — creating a second
 *     `useAuthState()` here would spawn an independent state tree and the
 *     gate would watch a session that never updates.
 *  2. It waits for `useRootNavigationState().key` before navigating. Without
 *     that guard the first render throws "Attempted to navigate before
 *     mounting the Root Layout component" and the app renders blank.
 */
function AuthGate() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return; // navigator not mounted yet
    if (loading) return;
    const inLogin = segments[0] === 'login';
    if (!session && !inLogin) router.replace('/login');
    else if (session && inLogin) router.replace('/');
  }, [navState?.key, session, loading, segments, router]);

  return null;
}

export default function RootLayout() {
  const authState = useAuthState();
  const padState = usePadState();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.navy }}>
        <StatusBar style="light" />
        <AuthContext.Provider value={authState}>
          <PadContext.Provider value={padState}>
            {authState.loading ? (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.navy,
                }}
                testID="boot-splash"
              >
                <ActivityIndicator color={colors.gold} size="large" />
              </View>
            ) : (
              <>
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: colors.navy },
                    headerTintColor: colors.parchment,
                    headerTitleStyle: { fontWeight: '700' },
                    contentStyle: { backgroundColor: colors.parchment },
                  }}
                >
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="grievance" options={{ title: 'Raise a Grievance' }} />
                  <Stack.Screen name="grievance-thread" options={{ title: 'Grievance' }} />
                  <Stack.Screen name="brochure" options={{ title: 'Product Brochure' }} />
                  <Stack.Screen name="support" options={{ title: 'Contact Aarohmm' }} />
                  <Stack.Screen name="schemes" options={{ title: 'Trade Schemes' }} />
                  <Stack.Screen name="order-placed" options={{ headerShown: false }} />
                </Stack>
                <AuthGate />
              </>
            )}
          </PadContext.Provider>
        </AuthContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
