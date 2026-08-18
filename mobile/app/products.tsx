import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type ProductRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setError(null);
    const { data, error: err } = await supabase
      .from('products_mirror')
      .select('id, name, channel, status, created_at, metadata')
      .eq('channel', 'b2c')
      .order('created_at', { ascending: false })
      .limit(50);
    if (err) setError(err.message);
    else setProducts((data as ProductRow[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center} testID="products-loading">
        <ActivityIndicator color="#d4af37" size="large" />
        <Text style={styles.hint}>Reading products_mirror from Supabase…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} testID="products-error">
        <Text style={styles.errorText}>Could not load products</Text>
        <Text style={styles.hint}>{error}</Text>
        <Text style={styles.hint}>
          Check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="products-list"
      data={products}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.hint}>No products yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row} testID={`product-row-${item.id}`}>
          <Text style={styles.rowTitle}>{item.name}</Text>
          <Text style={styles.rowMeta}>
            {item.channel.toUpperCase()} · {item.status}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  list: { padding: 16, gap: 8 },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#d4af37',
    marginBottom: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1e3a52' },
  rowMeta: { fontSize: 12, color: '#6b6357', marginTop: 2 },
  hint: { fontSize: 12, color: '#6b6357', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#b91c1c', fontWeight: '600' },
});
