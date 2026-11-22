import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order, OrderStatus } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

function StatusPill({ status }: { status: OrderStatus }) {
  const styles = useStyles();
  const map: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
    placed: { bg: "#F2EFEA", fg: "#4A4846", label: "Placed" },
    confirmed: { bg: "#E3E8E4", fg: "#3A4A3E", label: "Confirmed" },
    dispatched: { bg: "#FBEBD3", fg: "#8A5A1A", label: "Dispatched" },
    delivered: { bg: "#D6EADB", fg: "#265A3E", label: "Delivered" },
    cancelled: { bg: "#F4D9D6", fg: "#8E2C25", label: "Cancelled" },
  };
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders().then((r) => r.orders),
    enabled: !!user,
  });

  const orders = useMemo(() => {
    const data = ordersQ.data ?? [];
    if (filter === "all") return data;
    return data.filter((o: Order) => o.status === filter);
  }, [ordersQ.data, filter]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          {user?.role === "admin"
            ? "Every order placed on the network"
            : user?.role === "distributor"
            ? "Orders you received and placed"
            : "Your orders"}
        </Text>
      </View>

      <View style={styles.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={ordersQ.isRefetching} onRefresh={() => ordersQ.refetch()} tintColor={colors.brandPrimary} />
        }
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          ordersQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySub}>
                {user?.role === "retailer" ? "Punch your first order from the Catalog tab." : "Waiting on orders from your network."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`order-${item.id}`}
            onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNo}>{item.order_number}</Text>
              <Text style={styles.orderMeta}>
                {item.items.length} items · ₹{item.total_amount.toFixed(2)}
              </Text>
              <Text style={styles.orderMetaSmall}>
                {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                {" · "}
                {item.placed_by_role === "retailer" ? "From retailer" : "From distributor"}
              </Text>
            </View>
            <StatusPill status={item.status} />
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: c.onSurface, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.muted, fontSize: 12, marginTop: 2 },
  chipRow: { height: 56, justifyContent: "center" },
  chip: {
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { color: c.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: c.onBrandPrimary },
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
  orderNo: { color: c.onSurface, fontWeight: "700" },
  orderMeta: { color: c.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  orderMetaSmall: { color: c.muted, fontSize: 11, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginLeft: spacing.sm },
  pillText: { fontSize: 11, fontWeight: "700" },
  center: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.muted, fontSize: 12, marginTop: 4, textAlign: "center" },
}));
