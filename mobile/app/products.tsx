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
  category: string | null;
  price_inr: number | null;
  mrp_inr: number | null;
  stock_pieces: number | null;
  is_active: boolean;
  ready_to_use: boolean;
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
      .select(
        'id, name, channel, category, price_inr, mrp_inr, stock_pieces, is_active, ready_to_use'
      )
      .eq('channel', 'b2c')
      .eq('is_active', true)
      .order('name', { ascending: true })
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
            {(item.category || 'uncategorised').toUpperCase()}
            {item.ready_to_use ? ' · Ready-to-Use' : ''}
          </Text>
          <View style={styles.rowFooter}>
            <Text style={styles.price}>
              {item.price_inr != null ? `₹${item.price_inr}` : '—'}
            </Text>
            <Text style={styles.stock}>
              {item.stock_pieces != null ? `${item.stock_pieces} in stock` : ''}
            </Text>
          </View>
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
  rowMeta: { fontSize: 11, color: '#6b6357', marginTop: 2, letterSpacing: 0.5 },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    alignItems: 'center',
  },
  price: { fontSize: 16, fontWeight: '700', color: '#1e3a52' },
  stock: { fontSize: 11, color: '#6b6357' },
  hint: { fontSize: 12, color: '#6b6357', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#b91c1c', fontWeight: '600' },
});
