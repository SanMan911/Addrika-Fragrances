import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchProducts, type Product } from '../../lib/data';
import { usePad } from '../../lib/pad';
import { colors, inr, radius, shadow, space, type } from '../../lib/theme';

function StockPill({ pieces, perCarton }: { pieces: number; perCarton: number }) {
  const cartons = perCarton > 0 ? pieces / perCarton : 0;
  let bg: string = colors.successBg;
  let fg: string = colors.success;
  let label = `${pieces} pcs · ${cartons.toFixed(1)} ctn`;
  if (pieces <= 0) {
    bg = colors.dangerBg;
    fg = colors.danger;
    label = 'Out of stock';
  } else if (pieces <= 12) {
    bg = colors.warnBg;
    fg = colors.warn;
    label = `Only ${pieces} pcs left`;
  }
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ ...type.small, color: fg, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function QtyStepper({ product }: { product: Product }) {
  const { boxesFor, setBoxes } = usePad();
  const boxes = boxesFor(product.sku);
  const oos = product.stock_pieces <= 0;

  const change = (delta: number) =>
    setBoxes(
      {
        sku: product.sku,
        name: product.name,
        sizeLabel: product.size_label,
        indicativePricePerBox: Number(product.b2b_price || 0),
        imageUrl: product.image_url,
      },
      boxes + delta
    );

  if (oos) {
    return (
      <Text style={{ ...type.small, color: colors.danger, fontWeight: '700' }}>
        Unavailable
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Pressable
        testID={`stock-minus-${product.sku}`}
        onPress={() => change(-0.5)}
        disabled={boxes <= 0}
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.pill,
          backgroundColor: boxes > 0 ? colors.navy : colors.parchmentDim,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: boxes > 0 ? colors.gold : colors.textMuted, fontSize: 19 }}>−</Text>
      </Pressable>
      <Text
        testID={`stock-qty-${product.sku}`}
        style={{ ...type.h2, color: colors.text, minWidth: 36, textAlign: 'center' }}
      >
        {boxes % 1 === 0 ? boxes : boxes.toFixed(1)}
      </Text>
      <Pressable
        testID={`stock-plus-${product.sku}`}
        onPress={() => change(0.5)}
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.pill,
          backgroundColor: colors.navy,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.gold, fontSize: 19 }}>+</Text>
      </Pressable>
    </View>
  );
}

export default function StockScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setProducts(await fetchProducts());
    } catch (e: any) {
      setError(e?.message || 'Could not load stock.');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  const inStock = products.filter((p) => p.stock_pieces > 0).length;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="stock-loading">
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }} testID="stock-screen">
      <View style={{ padding: space.md, paddingBottom: space.sm }}>
        <Text style={{ ...type.small, color: colors.textMuted }}>
          {inStock} of {products.length} SKUs available · pull to refresh
        </Text>
        <TextInput
          testID="stock-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search fragrance or category"
          placeholderTextColor="#b4ada0"
          style={{
            marginTop: space.sm,
            backgroundColor: colors.white,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 3,
            fontSize: 15,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.parchmentDim,
          }}
        />
      </View>

      {error ? (
        <Text testID="stock-error" style={{ ...type.small, color: colors.danger, paddingHorizontal: space.md }}>
          {error}
        </Text>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(p) => p.sku}
        contentContainerStyle={{ padding: space.md, paddingTop: 0, paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />
        }
        ListEmptyComponent={
          <Text
            testID="stock-empty"
            style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl }}
          >
            No SKUs match “{query}”.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            testID={`stock-card-${item.sku}`}
            style={{
              backgroundColor: colors.white,
              borderRadius: radius.md,
              padding: space.md,
              marginBottom: space.md,
              flexDirection: 'row',
              gap: space.md,
              ...shadow.card,
            }}
          >
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: radius.sm,
                  backgroundColor: colors.parchment,
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: radius.sm,
                  backgroundColor: colors.parchment,
                }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.h2, color: colors.text }} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={{ ...type.small, color: colors.textMuted, marginTop: 2 }}>
                {[item.size_label, item.category].filter(Boolean).join(' · ') || item.sku}
              </Text>
              <View style={{ marginTop: space.sm }}>
                <StockPill pieces={item.stock_pieces} perCarton={item.pieces_per_carton} />
              </View>
              <View
                style={{
                  marginTop: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ ...type.label, color: colors.navy }}>
                    {inr(item.b2b_price)} <Text style={{ ...type.small, color: colors.textMuted }}>/box</Text>
                  </Text>
                  <Text style={{ ...type.small, color: colors.textMuted }}>
                    {item.pieces_per_carton} pcs/carton
                  </Text>
                </View>
                <QtyStepper product={item} />
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
