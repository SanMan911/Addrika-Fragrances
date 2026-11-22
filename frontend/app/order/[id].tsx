import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order, OrderStatus } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

const FLOW: OrderStatus[] = ["placed", "confirmed", "dispatched", "delivered"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "confirmed",
  confirmed: "dispatched",
  dispatched: "delivered",
};

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id!).then((r) => r.order),
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (status: OrderStatus) => api.updateStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["actionable"] });
    },
  });

  const order: Order | undefined = q.data;
  const canAct =
    !!order &&
    user &&
    (user.role === "admin" || (user.role === "distributor" && order.distributor_id === user.id));
  const nextStatus = order ? NEXT[order.status] : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: "Order" }} />
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <MaterialDesignIcons name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Order detail</Text>
      </View>

      {q.isLoading || !order ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }}>
          <View style={styles.summary}>
            <Text style={styles.orderNo} testID="order-number">{order.order_number}</Text>
            <Text style={styles.dim}>
              {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {order.placed_by_role === "retailer" ? "Retailer order" : "Distributor order"}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.timeline}>
            {FLOW.map((s, idx) => {
              const curIdx = FLOW.indexOf(order.status);
              const active = idx <= curIdx && order.status !== "cancelled";
              const current = idx === curIdx;
              return (
                <View key={s} style={styles.step}>
                  <View style={styles.stepCol}>
                    <View style={[styles.stepDot, active && styles.stepDotActive, current && styles.stepDotCurrent]} />
                    {idx < FLOW.length - 1 ? <View style={[styles.stepLine, active && styles.stepLineActive]} /> : null}
                  </View>
                  <View style={styles.stepTextCol}>
                    <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                    {current && <Text style={styles.dim}>Current status</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((i, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{i.name}</Text>
                <Text style={styles.dim}>
                  {i.sku}
                  {i.size_label ? ` · ${i.size_label}` : ""}
                </Text>
              </View>
              <Text style={styles.itemQty}>× {i.quantity}</Text>
              <Text style={styles.itemPrice}>₹{(i.unit_price * i.quantity).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.dim}>Subtotal</Text>
              <Text style={styles.itemName}>₹{order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.dim}>GST</Text>
              <Text style={styles.itemName}>₹{order.gst_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandValue} testID="order-total">₹{order.total_amount.toFixed(2)}</Text>
            </View>
          </View>

          {order.placed_by && (
            <>
              <Text style={styles.sectionTitle}>Placed by</Text>
              <View style={styles.party}>
                <Text style={styles.itemName}>{order.placed_by.business_name || order.placed_by.name}</Text>
                <Text style={styles.dim}>
                  {order.placed_by.name} · {order.placed_by.role} · GSTIN {order.placed_by.gstin}
                </Text>
                <Text style={styles.dim}>
                  {order.placed_by.email || "—"} · {order.placed_by.phone || "—"}
                </Text>
              </View>
            </>
          )}

          {order.distributor && (
            <>
              <Text style={styles.sectionTitle}>Assigned distributor</Text>
              <View style={styles.party}>
                <Text style={styles.itemName}>{order.distributor.business_name || order.distributor.name}</Text>
                <Text style={styles.dim}>GSTIN {order.distributor.gstin}</Text>
              </View>
            </>
          )}

          {order.notes ? (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={[styles.party, { color: colors.onSurface }]}>{order.notes}</Text>
            </>
          ) : null}
        </ScrollView>
      )}

      {canAct && nextStatus && order && (
        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            testID="advance-status-button"
            onPress={() => updateMut.mutate(nextStatus)}
            disabled={updateMut.isPending}
            style={[styles.primaryBtn, updateMut.isPending && { opacity: 0.6 }]}
          >
            {updateMut.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Mark as {nextStatus}</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  backBtn: { padding: 6, marginRight: 4 },
  title: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  summary: { marginBottom: spacing.lg },
  orderNo: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  dim: { color: c.muted, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", marginTop: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.brandTertiary },
  badgeText: { color: c.onBrandTertiary, fontSize: 11, fontWeight: "700" },
  sectionTitle: { color: c.onSurface, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.md, marginBottom: spacing.sm },
  timeline: { paddingLeft: 2 },
  step: { flexDirection: "row", gap: spacing.md, minHeight: 56 },
  stepCol: { alignItems: "center", width: 20 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.surfaceTertiary, borderWidth: 2, borderColor: c.border },
  stepDotActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  stepDotCurrent: { backgroundColor: c.brandSecondary, borderColor: c.brandSecondary, width: 14, height: 14, borderRadius: 7 },
  stepLine: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 },
  stepLineActive: { backgroundColor: c.brandPrimary },
  stepTextCol: { paddingBottom: spacing.md, flex: 1 },
  stepLabel: { color: c.muted, fontWeight: "600" },
  stepLabelActive: { color: c.onSurface },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  itemName: { color: c.onSurface, fontWeight: "700" },
  itemQty: { color: c.muted, marginHorizontal: spacing.sm },
  itemPrice: { color: c.onSurface, fontWeight: "700", minWidth: 80, textAlign: "right" },
  totals: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  grandLabel: { color: c.onSurface, fontSize: 16, fontWeight: "800", marginTop: 6 },
  grandValue: { color: c.onSurface, fontSize: 18, fontWeight: "800", marginTop: 6 },
  party: { padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  primaryBtn: { backgroundColor: c.brandPrimary, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  center: { padding: spacing.xl, alignItems: "center" },
}));
