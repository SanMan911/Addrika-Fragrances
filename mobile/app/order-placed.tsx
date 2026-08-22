import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MOBILE_BRAND_NAME } from '../lib/brand';

/**
 * Order Placed celebration screen.
 *
 * Reached exclusively via `router.push('/order-placed?...')` from
 * `useOrderWatcher` in `_layout.tsx` when a newer B2B order id is
 * detected on foreground. Query params carry the order data so this
 * route never has to make its own API call — snappy first paint.
 *
 * Params
 * ------
 *   order_number?   Human-readable order number (e.g. B2B-2026-0142)
 *   order_id?       Internal id — used as a fallback title
 *   grand_total?    INR total (integer string)
 *   items?          Number of line items in the order
 *
 * Design
 * ------
 *   * Pure RN primitives + Animated (no confetti lib, no LinearGradient)
 *     so it survives EAS Android builds without new deps.
 *   * Serif wordmark for continuity with the rest of the app.
 *   * Two haloed gold rings + a spring-scaled checkmark disc give the
 *     "moment of delight" without leaning on emojis.
 */

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

function formatCurrency(n: number | string | undefined): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '';
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
}

export default function OrderPlacedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    order_number?: string;
    order_id?: string;
    grand_total?: string;
    items?: string;
  }>();

  const scale = useMemo(() => new Animated.Value(0.4), []);
  const ringPulse = useMemo(() => new Animated.Value(0), []);
  const fade = useMemo(() => new Animated.Value(0), []);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => setEntered(true));

    Animated.loop(
      Animated.timing(ringPulse, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ).start();
  }, [scale, ringPulse, fade]);

  const ringInnerScale = ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const ringInnerOpacity = ringPulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.45, 0.15, 0] });

  const orderLabel = params.order_number || params.order_id || 'your order';
  const total = formatCurrency(params.grand_total);
  const itemCount = Number(params.items) || 0;

  return (
    <View style={styles.root} testID="order-placed-screen">
      <View style={styles.halo} pointerEvents="none" />
      <View style={styles.halo2} pointerEvents="none" />

      <View style={styles.stage}>
        <Animated.View
          style={[styles.ringPulse, { transform: [{ scale: ringInnerScale }], opacity: ringInnerOpacity }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[styles.checkDisc, { transform: [{ scale }] }]}
          testID="order-placed-check"
        >
          <Text style={styles.checkGlyph}>✓</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: fade, alignItems: 'center', gap: 6 }}>
        <Text style={styles.eyebrow}>Order Placed</Text>
        <Text style={styles.title} testID="order-placed-title">
          {orderLabel}
        </Text>
        <View style={styles.rule} />
        {total ? (
          <Text style={styles.total} testID="order-placed-total">{total}</Text>
        ) : null}
        {itemCount > 0 ? (
          <Text style={styles.subline}>
            {itemCount} SKU{itemCount === 1 ? '' : 's'} · we&apos;ll call you to confirm dispatch
          </Text>
        ) : (
          <Text style={styles.subline}>
            We&apos;ll call you to confirm dispatch
          </Text>
        )}
        <Text style={styles.brandline}>
          Thanks for choosing {MOBILE_BRAND_NAME}
        </Text>
      </Animated.View>

      {entered ? (
        <View style={styles.actionRow}>
          <Pressable
            testID="order-placed-view-orders-btn"
            style={({ pressed }) => [styles.ctaPrimary, pressed && styles.ctaPressed]}
            android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.ctaPrimaryText}>Back to Home</Text>
          </Pressable>
          <Pressable
            testID="order-placed-shop-more-btn"
            style={({ pressed }) => [styles.ctaSecondary, pressed && styles.ctaPressed]}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
            onPress={() => router.replace('/products')}
          >
            <Text style={styles.ctaSecondaryText}>Order Again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1e3a52',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 22,
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    top: -160,
    left: -160,
  },
  halo2: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(217, 119, 87, 0.10)',
    bottom: -140,
    right: -120,
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringPulse: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  checkDisc: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  checkGlyph: {
    fontSize: 62,
    color: '#1e3a52',
    fontWeight: '800',
    marginTop: -6,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 4,
    color: '#d4af37',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '700',
    color: '#f4e7c1',
    letterSpacing: 1,
    textAlign: 'center',
  },
  rule: {
    width: 60,
    height: 2,
    backgroundColor: '#d4af37',
    marginVertical: 6,
  },
  total: {
    fontFamily: SERIF,
    fontSize: 24,
    color: '#f4e7c1',
    fontWeight: '600',
    letterSpacing: 1,
  },
  subline: {
    fontSize: 13,
    color: '#c8bfa9',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  brandline: {
    marginTop: 8,
    fontSize: 12,
    color: '#8a8272',
    letterSpacing: 1,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: '#d4af37',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#1e3a52',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  ctaSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4af37',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: '#f4e7c1',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 1,
  },
  ctaPressed: { opacity: 0.85 },
});
