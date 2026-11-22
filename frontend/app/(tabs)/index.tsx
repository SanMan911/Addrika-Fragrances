import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

function formatRs(n: number) {
  return `₹${n.toFixed(2)}`;
}

function StatusPill({ status }: { status: Order["status"] }) {
  const styles = useStyles();
  const map: Record<Order["status"], { bg: string; fg: string; label: string }> = {
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

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();

  const actionableQ = useQuery({
    queryKey: ["actionable"],
    queryFn: () => api.actionable().then((r) => r.orders),
    enabled: !!user,
  });
  const allQ = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders().then((r) => r.orders),
    enabled: !!user,
  });

  const roleLabel = user?.role === "admin" ? "Admin" : user?.role === "distributor" ? "Distributor" : "Retailer";
  const actionable = actionableQ.data ?? [];
  const all = allQ.data ?? [];

  const pendingCount = actionable.length;
  const completedCount = all.filter((o) => o.status === "delivered").length;

  const actionableTitle =
    user?.role === "admin"
      ? "Orders from Distributors"
      : user?.role === "distributor"
      ? "Orders from your Retailers"
      : "Your open orders";

  function onRefresh() {
    actionableQ.refetch();
    allQ.refetch();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0] ?? "there"}</Text>
            <Text style={styles.business} numberOfLines={1}>
              {user?.business_name || user?.gstin}
            </Text>
          </View>
          <View style={styles.rolePill} testID="role-pill">
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={actionable}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={actionableQ.isRefetching || allQ.isRefetching} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary }]}>
                <MaterialDesignIcons name="timer-sand" size={22} color={colors.warning} />
                <Text style={styles.statNum} testID="pending-count">
                  {pendingCount}
                </Text>
                <Text style={styles.statLabel}>Actionable</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surfaceSecondary }]}>
                <MaterialDesignIcons name="check-decagram" size={22} color={colors.success} />
                <Text style={styles.statNum} testID="completed-count">
                  {completedCount}
                </Text>
                <Text style={styles.statLabel}>Delivered</Text>
              </View>
            </View>

            {user?.role !== "admin" && (
              <Pressable
                testID="punch-new-order-button"
                onPress={() => router.push("/(tabs)/catalog")}
                style={styles.punchBtn}
              >
                <MaterialDesignIcons name="plus-circle" size={20} color={colors.onBrandPrimary} />
                <Text style={styles.punchBtnText}>Punch new order</Text>
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>{actionableTitle}</Text>
          </View>
        }
        ListEmptyComponent={
          actionableQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Image
                source={{
                  uri: "https://images.unsplash.com/photo-1790891526007-fb2aa1af1df0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwyfHxib3hlcyUyMHdhcmVob3VzZSUyMGIyYnxlbnwwfHx8fDE3OTUwOTI0NDZ8MA&ixlib=rb-4.1.0&q=85",
                }}
                style={styles.emptyImg}
              />
              <Text style={styles.emptyText}>No pending tasks</Text>
              <Text style={styles.emptySub}>
                {user?.role === "retailer" ? "Punch an order to see it here." : "You're all caught up."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`order-row-${item.id}`}
            onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
            style={styles.orderRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNo}>{item.order_number}</Text>
              <Text style={styles.orderMeta} numberOfLines={1}>
                {item.items.length} items · {formatRs(item.total_amount)}
              </Text>
              <Text style={styles.orderMetaSmall}>
                {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </Text>
            </View>
            <StatusPill status={item.status} />
          </Pressable>
        )}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      />
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { color: c.onSurface, fontSize: 20, fontWeight: "700" },
  business: { color: c.muted, fontSize: 13, marginTop: 2 },
  rolePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
  },
  rolePillText: { color: c.onBrandTertiary, fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  statNum: { color: c.onSurface, fontSize: 24, fontWeight: "800", marginTop: 6 },
  statLabel: { color: c.muted, fontSize: 12, marginTop: 2 },
  punchBtn: {
    backgroundColor: c.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  punchBtnText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  sectionTitle: { color: c.onSurface, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  orderNo: { color: c.onSurface, fontSize: 14, fontWeight: "700" },
  orderMeta: { color: c.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  orderMetaSmall: { color: c.muted, fontSize: 11, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginLeft: spacing.sm },
  pillText: { fontSize: 11, fontWeight: "700" },
  center: { padding: spacing.xl, alignItems: "center" },
  emptyCard: {
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  emptyImg: { width: 120, height: 120, borderRadius: radius.md, marginBottom: spacing.md, opacity: 0.85 },
  emptyText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.muted, fontSize: 12, marginTop: 4, textAlign: "center" },
}));
