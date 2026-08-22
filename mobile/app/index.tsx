import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { supabase } from '../lib/supabase';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE } from '../lib/brand';
import { openWhatsAppTo } from '../lib/web';

/**
 * Serif family that ships with both iOS and Android without extra font
 * downloads or expo-font wiring — keeps the app EAS-build-clean while
 * still giving the fragrance brand a proper display face. Playfair /
 * Cormorant can slot in later via `expo-font` once assets are approved.
 */
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

type SpotlightRow = {
  id: string;
  name: string;
  category: string | null;
  price_inr: number | null;
  mrp_inr: number | null;
};

export default function HomeScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [spotlights, setSpotlights] = useState<SpotlightRow[]>([]);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { session } = useSession();
  const { itemCount, subtotal } = useCart();

  useEffect(() => {
    fetchAppConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  // Fragrance Spotlight — pulls up to 8 live B2B products from Supabase
  // mirror and rotates through them every 6 s so the home screen feels
  // alive. B2B-only (Iter 98).
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products_mirror')
        .select('id, name, category, price_inr, mrp_inr')
        .eq('channel', 'b2b')
        .eq('is_active', true)
        .not('price_inr', 'is', null)
        .order('mirrored_at', { ascending: false })
        .limit(8);
      if (data && data.length) setSpotlights(data as SpotlightRow[]);
    })();
  }, []);

  useEffect(() => {
    if (spotlights.length < 2) return;
    const t = setInterval(
      () => setSpotlightIdx((i) => (i + 1) % spotlights.length),
      6000,
    );
    return () => clearInterval(t);
  }, [spotlights.length]);

  const spotlight = spotlights[spotlightIdx];

  const catalogueCount = useMemo(() => {
    // B2B-only mobile — surface the B2B SKU count. Flip back to
    // `b2c_products` when B2C is re-enabled.
    return config?.catalog?.b2b_skus ?? '—';
  }, [config]);

  const openGrievances = () =>
    openWhatsAppTo(
      '918377020402',
      `Hi ${MOBILE_BRAND_NAME}, I have a concern to share: `,
    );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      testID="home-screen"
      style={styles.root}
    >
      {/* Deep-navy canvas with a soft ember halo behind the wordmark. */}
      <View style={styles.hero} testID="home-hero">
        <View style={styles.halo} pointerEvents="none" />
        <View style={styles.halo2} pointerEvents="none" />
        <Text style={styles.heroBrand} testID="home-brand-name">
          {MOBILE_BRAND_NAME}
        </Text>
        <View style={styles.heroRule} />
        <Text style={styles.heroTagline} testID="home-tagline">
          {MOBILE_BRAND_TAGLINE}
        </Text>
      </View>

      {session ? (
        <View style={styles.welcome} testID="home-welcome">
          <Text style={styles.welcomeName}>Welcome, {session.displayName}</Text>
        </View>
      ) : null}

      {/* Fragrance Spotlight — dynamic replacement for the tree counter. */}
      <View style={styles.spotlight} testID="home-spotlight-card">
        <Text style={styles.cardLabel}>Fragrance Spotlight</Text>
        {spotlight ? (
          <>
            <Text style={styles.spotlightName} testID="home-spotlight-name">
              {spotlight.name}
            </Text>
            <View style={styles.spotlightMetaRow}>
              <Text style={styles.spotlightCategory}>
                {(spotlight.category || 'incense').toUpperCase()}
              </Text>
              {spotlight.price_inr != null ? (
                <Text style={styles.spotlightPrice}>
                  from ₹{Number(spotlight.price_inr).toFixed(0)}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <ActivityIndicator color="#d4af37" />
        )}
      </View>

      {/* Catalogue — no B2B copy anywhere. */}
      <View style={styles.card} testID="home-catalog-card">
        <Text style={styles.cardLabel}>Catalogue</Text>
        <Text style={styles.cardValue}>{catalogueCount} fragrances</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={() => router.push('/products')}
        testID="home-view-products-btn"
        android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
      >
        <Text style={styles.ctaText}>Browse Fragrances →</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.ctaSecondary, pressed && styles.ctaPressed]}
        onPress={() => router.push('/cart')}
        testID="home-view-cart-btn"
        android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
      >
        <Text style={styles.ctaSecondaryText}>
          Your Cart
          {itemCount > 0 ? `  ·  ${itemCount} items  ·  ₹${subtotal}` : '  ·  empty'}
        </Text>
      </Pressable>

      {/* Grievances → WhatsApp to admin. Replaces retailer-facing CTAs. */}
      <Pressable
        onPress={openGrievances}
        style={styles.grievancesBtn}
        testID="home-grievances-btn"
        android_ripple={{ color: 'rgba(212, 175, 55, 0.15)' }}
      >
        <Text style={styles.grievancesText}>Grievances?</Text>
        <Text style={styles.grievancesSub}>Message us on WhatsApp — we listen.</Text>
      </Pressable>

      {error ? (
        <Text style={styles.errorText} testID="home-config-error">
          Offline · {error}
        </Text>
      ) : null}

      <Text style={styles.footer}>
        Handcrafted in India · Schema v{config?.schema_version ?? '—'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#faf7f2' },
  container: { padding: 20, gap: 14, paddingTop: 48, paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    paddingVertical: 44,
    borderRadius: 24,
    backgroundColor: '#1e3a52',
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    top: -140,
    left: -80,
  },
  halo2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(217, 119, 87, 0.14)',
    bottom: -110,
    right: -70,
  },
  heroBrand: {
    fontFamily: SERIF,
    fontSize: 52,
    fontWeight: '700',
    color: '#f4e7c1',
    letterSpacing: 3,
    textAlign: 'center',
  },
  heroRule: {
    width: 80,
    height: 2,
    backgroundColor: '#d4af37',
    marginVertical: 14,
  },
  heroTagline: {
    fontFamily: SERIF,
    fontSize: 15,
    color: '#e8dcc1',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
  },
  welcome: { alignItems: 'center', gap: 2, marginTop: -2 },
  welcomeName: {
    fontSize: 13,
    color: '#1e3a52',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  spotlight: {
    backgroundColor: '#fff',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8dcc1',
    // Subtle ember-shadow to give the card presence without heavy elevation.
    shadowColor: '#d97757',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  spotlightName: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '600',
    color: '#1e3a52',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  spotlightMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  spotlightCategory: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#8a8272',
    fontWeight: '700',
  },
  spotlightPrice: {
    fontFamily: SERIF,
    fontSize: 16,
    color: '#d4af37',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#d4af37',
  },
  cardLabel: {
    fontSize: 11,
    color: '#8a8272',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  cardValue: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '600',
    color: '#1e3a52',
    marginTop: 6,
  },
  errorText: { fontSize: 12, color: '#b91c1c', marginTop: 4, textAlign: 'center' },
  cta: {
    backgroundColor: '#1e3a52',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#d4af37', fontWeight: '700', fontSize: 15, letterSpacing: 1 },
  ctaSecondary: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  ctaSecondaryText: {
    color: '#1e3a52',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  grievancesBtn: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#fdf7ee',
    borderWidth: 1,
    borderColor: '#e8dcc1',
    alignItems: 'center',
    gap: 2,
  },
  grievancesText: {
    fontFamily: SERIF,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e3a52',
    letterSpacing: 0.5,
  },
  grievancesSub: {
    fontSize: 11,
    color: '#6b6357',
    fontStyle: 'italic',
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#a89f8b',
    marginTop: 20,
    letterSpacing: 1,
  },
});
