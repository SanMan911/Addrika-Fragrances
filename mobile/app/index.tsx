import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { fetchAppConfig, type AppConfig } from '../lib/config';

export default function HomeScreen() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} testID="home-screen">
      <Text style={styles.h1} testID="home-brand-name">
        {config?.brand.name || 'Addrika'}
      </Text>
      <Text style={styles.tagline} testID="home-tagline">
        {config?.brand.tagline || 'Natural Fragrance, Rooted in Tradition'}
      </Text>

      <View style={styles.card} testID="home-impact-card">
        <Text style={styles.cardLabel}>Trees Planted</Text>
        {config ? (
          <Text style={styles.cardValue} testID="home-trees-planted">
            {config.impact.trees_planted}
          </Text>
        ) : error ? (
          <Text style={styles.errorText} testID="home-config-error">
            Offline · {error}
          </Text>
        ) : (
          <ActivityIndicator color="#d4af37" />
        )}
      </View>

      <View style={styles.card} testID="home-catalog-card">
        <Text style={styles.cardLabel}>Catalog</Text>
        <Text style={styles.cardValue}>
          {config?.catalog.b2c_count ?? '—'} storefront · {config?.catalog.b2b_count ?? '—'} B2B
        </Text>
      </View>

      <Link href="/products" asChild>
        <Pressable style={styles.cta} testID="home-view-products-btn">
          <Text style={styles.ctaText}>Browse Products →</Text>
        </Pressable>
      </Link>

      <Text style={styles.footer}>
        Reads from Supabase · Writes via FastAPI · Schema v{config?.schema_version ?? '—'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  h1: { fontSize: 32, fontWeight: '700', color: '#1e3a52', marginTop: 12 },
  tagline: { fontSize: 14, color: '#6b6357', marginBottom: 8 },
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
  ctaText: { color: '#d4af37', fontWeight: '600', fontSize: 16 },
  footer: { textAlign: 'center', fontSize: 11, color: '#8a8272', marginTop: 24 },
});
