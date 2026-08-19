import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useCart } from '../lib/cart';

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
  const { add, lines } = useCart();

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
        <Text style={styles.hint}>Loading catalogue…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} testID="products-error">
        <Text style={styles.errorText}>Could not load products</Text>
        <Text style={styles.hint}>{error}</Text>
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
      renderItem={({ item }) => {
        const price = item.price_inr != null ? Number(item.price_inr) : 0;
        const inStock = (item.stock_pieces ?? 0) > 0;
        const inCart = lines.find((l) => l.productId === item.id);
        return (
          <View style={styles.row} testID={`product-row-${item.id}`}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {(item.category || 'uncategorised').toUpperCase()}
                {item.ready_to_use ? ' · Ready-to-Use' : ''}
              </Text>
              <View style={styles.rowFooter}>
                <Text style={styles.price}>{price > 0 ? `₹${price}` : '—'}</Text>
                <Text style={[styles.stock, !inStock && styles.stockOut]}>
                  {inStock ? `${item.stock_pieces} in stock` : 'Coming soon'}
                </Text>
              </View>
            </View>
            <Pressable
              testID={`add-to-cart-${item.id}`}
              style={({ pressed }) => [
                styles.addBtn,
                !inStock && styles.addBtnDisabled,
                pressed && inStock && styles.addBtnPressed,
              ]}
              disabled={!inStock}
              android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
              onPress={() =>
                add({
                  productId: item.id,
                  name: item.name,
                  size: '50g',
                  priceInr: price,
                  quantity: 1,
                })
              }
            >
              <Text style={[styles.addBtnText, !inStock && styles.addBtnTextDisabled]}>
                {inCart ? `In cart · ${inCart.quantity}` : inStock ? 'Add' : '—'}
              </Text>
            </Pressable>
          </View>
        );
      }}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: { flex: 1 },
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
  stockOut: { color: '#b47d00', fontStyle: 'italic' },
  hint: { fontSize: 12, color: '#6b6357', textAlign: 'center' },
  errorText: { fontSize: 14, color: '#b91c1c', fontWeight: '600' },
  addBtn: {
    backgroundColor: '#1e3a52',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  addBtnPressed: { opacity: 0.85 },
  addBtnDisabled: { backgroundColor: '#e6dfd0' },
  addBtnText: { color: '#d4af37', fontWeight: '700', fontSize: 13 },
  addBtnTextDisabled: { color: '#a89f8b' },
});
