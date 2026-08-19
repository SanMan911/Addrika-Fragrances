import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchAppConfig, type AppConfig } from '../lib/config';
import { useSession } from '../lib/session';
import { useCart } from '../lib/cart';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE } from '../lib/brand';

export default function HomeScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session, logout } = useSession();
  const { itemCount, subtotal } = useCart();

  useEffect(() => {
    fetchAppConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  const brand = MOBILE_BRAND_NAME;
  const tagline = MOBILE_BRAND_TAGLINE;

  return (
    <ScrollView contentContainerStyle={styles.container} testID="home-screen">
      {/* Brand hero — the whole screen is a canvas for the wordmark */}
      <View style={styles.hero} testID="home-hero">
        <Text style={styles.heroBrand} testID="home-brand-name">{brand}</Text>
        <View style={styles.heroRule} />
        <Text style={styles.heroTagline} testID="home-tagline">{tagline}</Text>
      </View>

      {session ? (
        <View style={styles.welcome} testID="home-welcome">
          <Text style={styles.welcomeKind}>
            {session.kind === 'retailer' ? 'Retailer' : 'Customer'}
          </Text>
          <Text style={styles.welcomeName}>Welcome, {session.displayName}</Text>
        </View>
      ) : null}

      <View style={styles.card} testID="home-impact-card">
        <Text style={styles.cardLabel}>Trees Planted</Text>
        {config ? (
          <Text style={styles.cardValue} testID="home-trees-planted">
            {config.impact.trees_planted}
          </Text>
        ) : error ? (
          <Text style={styles.errorText} testID="home-config-error">Offline · {error}</Text>
        ) : (
          <ActivityIndicator color="#d4af37" />
        )}
      </View>

      <View style={styles.card} testID="home-catalog-card">
        <Text style={styles.cardLabel}>Catalogue</Text>
        <Text style={styles.cardValue}>
          {config?.catalog.b2c_products ?? '—'} storefront · {config?.catalog.b2b_skus ?? '—'} B2B
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={() => router.push('/products')}
        testID="home-view-products-btn"
        android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
      >
        <Text style={styles.ctaText}>
          {session?.kind === 'retailer' ? 'Browse B2B Catalogue →' : 'Browse Products →'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.ctaSecondary, pressed && styles.ctaPressed]}
        onPress={() => router.push('/cart')}
        testID="home-view-cart-btn"
        android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
      >
        <Text style={styles.ctaSecondaryText}>
          Your Cart{itemCount > 0 ? `  ·  ${itemCount} items  ·  ₹${subtotal}` : '  · empty'}
        </Text>
      </Pressable>

      {session ? (
        <Pressable
          onPress={logout}
          style={styles.logoutBtn}
          testID="home-logout-btn"
          android_ripple={{ color: 'rgba(30, 58, 82, 0.1)' }}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      ) : null}

      <Text style={styles.footer}>
        Reads live · Writes via FastAPI · Schema v{config?.schema_version ?? '—'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingTop: 60 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  heroBrand: { fontSize: 48, fontWeight: '700', color: '#1e3a52', letterSpacing: 2 },
  heroRule: { width: 60, height: 2, backgroundColor: '#d4af37', marginVertical: 10 },
  heroTagline: { fontSize: 13, color: '#6b6357', fontStyle: 'italic', letterSpacing: 0.5 },
  welcome: { alignItems: 'center', gap: 2 },
  welcomeKind: {
    fontSize: 10, letterSpacing: 2, color: '#d4af37', fontWeight: '700', textTransform: 'uppercase',
  },
  welcomeName: { fontSize: 14, color: '#1e3a52', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d4af37',
  },
  cardLabel: { fontSize: 12, color: '#6b6357', textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 24, fontWeight: '600', color: '#1e3a52', marginTop: 4 },
  errorText: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  cta: {
    backgroundColor: '#1e3a52',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#d4af37', fontWeight: '700', fontSize: 16 },
  ctaSecondary: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  ctaSecondaryText: { color: '#1e3a52', fontWeight: '600', fontSize: 14 },
  logoutBtn: { alignItems: 'center', marginTop: 4, padding: 10 },
  logoutText: { fontSize: 13, color: '#8a8272', textDecorationLine: 'underline' },
  footer: { textAlign: 'center', fontSize: 11, color: '#8a8272', marginTop: 24 },
});
