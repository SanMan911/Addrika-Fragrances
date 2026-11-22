import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Product } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

function stockTone(stock: number) {
  if (stock <= 0) return "out";
  if (stock < 50) return "low";
  return "ok";
}

export default function Catalog() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { items, totalQty, subtotal, add, sub } = useCart();
  const [q, setQ] = useState("");

  const prodQ = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products().then((r) => r.products),
    enabled: !!user,
  });

  const products = useMemo(() => {
    const data = prodQ.data ?? [];
    if (!q.trim()) return data;
    const t = q.toLowerCase();
    return data.filter(
      (p) => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || (p.category || "").toLowerCase().includes(t),
    );
  }, [prodQ.data, q]);

  if (user?.role === "admin") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Catalog</Text>
        </View>
        <View style={styles.center}>
          <MaterialDesignIcons name="shield-crown-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>Admins don't place orders</Text>
          <Text style={styles.emptySub}>Use Orders tab to review and action distributor orders.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Catalog</Text>
        <Text style={styles.subtitle}>Live stock from Aarohmm inventory</Text>
        <View style={styles.searchBox}>
          <MaterialDesignIcons name="magnify" size={18} color={colors.muted} />
          <TextInput
            testID="catalog-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search name, SKU or category"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.sku}
        refreshControl={
          <RefreshControl refreshing={prodQ.isRefetching} onRefresh={() => prodQ.refetch()} tintColor={colors.brandPrimary} />
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        ListEmptyComponent={
          prodQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : (
            <View style={styles.center}>
              <MaterialDesignIcons name="package-variant" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No products match</Text>
            </View>
          )
        }
        renderItem={({ item }: { item: Product }) => {
          const qty = items[item.sku]?.quantity ?? 0;
          const tone = stockTone(item.stock_pieces);
          return (
            <View style={styles.row} testID={`product-row-${item.sku}`}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.meta}>
                  {item.sku}
                  {item.size_label ? ` · ${item.size_label}` : ""}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{Number(item.b2b_price ?? 0).toFixed(2)}</Text>
                  {item.mrp ? <Text style={styles.mrp}>MRP ₹{Number(item.mrp).toFixed(2)}</Text> : null}
                </View>
                <View
                  style={[
                    styles.stockBadge,
                    tone === "out" && styles.stockOut,
                    tone === "low" && styles.stockLow,
                    tone === "ok" && styles.stockOk,
                  ]}
                >
                  <Text style={styles.stockText} testID={`stock-${item.sku}`}>
                    {tone === "out" ? "Out of stock" : `${item.stock_pieces} in stock`}
                  </Text>
                </View>
              </View>

              <View style={styles.stepper}>
                <Pressable
                  testID={`dec-${item.sku}`}
                  onPress={() => sub(item)}
                  disabled={qty <= 0}
                  style={[styles.stepBtn, qty <= 0 && { opacity: 0.4 }]}
                >
                  <MaterialDesignIcons name="minus" size={18} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.qty} testID={`qty-${item.sku}`}>
                  {qty}
                </Text>
                <Pressable
                  testID={`inc-${item.sku}`}
                  onPress={() => add(item)}
                  disabled={item.stock_pieces <= qty}
                  style={[styles.stepBtn, item.stock_pieces <= qty && { opacity: 0.4 }]}
                >
                  <MaterialDesignIcons name="plus" size={18} color={colors.onSurface} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {totalQty > 0 && (
        <View style={[styles.cartBar, { bottom: insets.bottom + 56 }]} pointerEvents="box-none">
          <BlurView intensity={Platform.OS === "ios" ? 50 : 30} tint="light" style={styles.cartBlur}>
            <View style={styles.cartInner}>
              <View>
                <Text style={styles.cartQty} testID="cart-total-qty">
                  {totalQty} item{totalQty > 1 ? "s" : ""}
                </Text>
                <Text style={styles.cartSub} testID="cart-subtotal">
                  ₹{subtotal.toFixed(2)}
                </Text>
              </View>
              <Pressable
                testID="review-order-button"
                onPress={() => router.push("/review")}
                style={styles.reviewBtn}
              >
                <Text style={styles.reviewBtnText}>Review order</Text>
                <MaterialDesignIcons name="arrow-right" size={16} color={colors.onBrandPrimary} />
              </Pressable>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: c.surface,
  },
  title: { color: c.onSurface, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.muted, fontSize: 12, marginTop: 2 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: spacing.sm, color: c.onSurface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  name: { color: c.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  meta: { color: c.muted, fontSize: 11, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6, gap: spacing.sm },
  price: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
  mrp: { color: c.muted, fontSize: 11, textDecorationLine: "line-through" },
  stockBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  stockOk: { backgroundColor: "#E0EDE4" },
  stockLow: { backgroundColor: "#FBEBD3" },
  stockOut: { backgroundColor: "#F4D9D6" },
  stockText: { fontSize: 11, fontWeight: "700", color: c.onSurfaceSecondary },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  qty: { minWidth: 20, textAlign: "center", color: c.onSurface, fontWeight: "700" },
  cartBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  cartBlur: { backgroundColor: "rgba(255,255,255,0.75)" },
  cartInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.lg,
  },
  cartQty: { color: c.onSurface, fontWeight: "700" },
  cartSub: { color: c.muted, fontSize: 12, marginTop: 2 },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
  },
  reviewBtnText: { color: c.onBrandPrimary, fontWeight: "700" },
  center: { padding: spacing.xl, alignItems: "center", gap: 8 },
  emptyText: { color: c.onSurface, fontWeight: "700", marginTop: 6 },
  emptySub: { color: c.muted, fontSize: 12, marginTop: 2, textAlign: "center" },
}));
