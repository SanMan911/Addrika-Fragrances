import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Distributor } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

export default function Review() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { items, subtotal, totalQty, add, sub, clear, toOrderItems } = useCart();
  const qc = useQueryClient();

  const [notes, setNotes] = useState("");
  const [distributorId, setDistributorId] = useState<string | null>(user?.assigned_distributor_id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const distQ = useQuery({
    queryKey: ["distributors"],
    queryFn: () => api.distributors().then((r) => r.distributors),
    enabled: user?.role === "retailer" && !user?.assigned_distributor_id,
  });

  useEffect(() => {
    if (user?.role === "retailer" && user.assigned_distributor_id) setDistributorId(user.assigned_distributor_id);
  }, [user]);

  const gst = +(subtotal * 0.18).toFixed(2);
  const total = +(subtotal + gst).toFixed(2);
  const itemList = Object.values(items);

  async function submit() {
    setErr(null);
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        items: toOrderItems(),
        distributor_id: user?.role === "retailer" ? distributorId ?? undefined : undefined,
        notes: notes.trim() || undefined,
      });
      clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["actionable"] });
      router.replace({ pathname: "/order/[id]", params: { id: res.order.id } });
    } catch (e: any) {
      setErr(e.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (itemList.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ title: "Review order" }} />
        <View style={styles.header}>
          <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
            <MaterialDesignIcons name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Review order</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Your cart is empty</Text>
        </View>
      </View>
    );
  }

  const needsDistributor = user?.role === "retailer" && !distributorId;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: "Review order" }} />
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <MaterialDesignIcons name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Review order</Text>
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 140 }}
        bottomOffset={24}
      >
        <Text style={styles.sectionTitle}>Items ({totalQty})</Text>
        {itemList.map(({ product, quantity }) => (
          <View key={product.sku} style={styles.itemRow} testID={`review-item-${product.sku}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.itemMeta}>
                {product.sku}
                {product.size_label ? ` · ${product.size_label}` : ""}
              </Text>
              <Text style={styles.itemPrice}>₹{(product.b2b_price ?? 0).toFixed(2)} each</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable testID={`review-dec-${product.sku}`} onPress={() => sub(product)} style={styles.stepBtn}>
                <MaterialDesignIcons name="minus" size={16} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.qty}>{quantity}</Text>
              <Pressable
                testID={`review-inc-${product.sku}`}
                onPress={() => add(product)}
                disabled={product.stock_pieces <= quantity}
                style={[styles.stepBtn, product.stock_pieces <= quantity && { opacity: 0.4 }]}
              >
                <MaterialDesignIcons name="plus" size={16} color={colors.onSurface} />
              </Pressable>
            </View>
          </View>
        ))}

        {user?.role === "retailer" && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionTitle}>Send to distributor</Text>
            {user.assigned_distributor_id ? (
              <View style={styles.distAssigned} testID="assigned-distributor">
                <MaterialDesignIcons name="check-circle" size={18} color={colors.success} />
                <Text style={styles.distAssignedText}>
                  Assigned distributor (ID ...{user.assigned_distributor_id.slice(-6)})
                </Text>
              </View>
            ) : distQ.isLoading ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              (distQ.data ?? []).map((d: Distributor) => {
                const active = distributorId === d.id;
                return (
                  <Pressable
                    key={d.id}
                    testID={`select-distributor-${d.id}`}
                    onPress={() => setDistributorId(d.id)}
                    style={[styles.distRow, active && styles.distRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.distName}>{d.business_name || d.name}</Text>
                      <Text style={styles.distMeta}>{d.gstin}</Text>
                    </View>
                    {active && <MaterialDesignIcons name="check-circle" size={18} color={colors.success} />}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Notes (optional)</Text>
        <TextInput
          testID="order-notes-input"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="e.g., deliver before Friday"
          placeholderTextColor={colors.muted}
          style={styles.notes}
        />

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (18%)</Text>
            <Text style={styles.totalValue}>₹{gst.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: spacing.sm }]}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue} testID="review-total">₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {err ? (
          <Text testID="review-error" style={{ color: colors.error, marginTop: spacing.md }}>
            {err}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="place-order-button"
          onPress={submit}
          disabled={submitting || needsDistributor}
          style={[styles.primaryBtn, (submitting || needsDistributor) && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {needsDistributor ? "Pick a distributor" : `Place order · ₹${total.toFixed(2)}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  backBtn: { padding: 6, marginRight: 4 },
  title: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  sectionTitle: { color: c.onSurface, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm, marginTop: spacing.sm, textTransform: "uppercase", letterSpacing: 1 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  itemName: { color: c.onSurface, fontWeight: "700" },
  itemMeta: { color: c.muted, fontSize: 11, marginTop: 2 },
  itemPrice: { color: c.onSurface, marginTop: 4, fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  qty: { minWidth: 20, textAlign: "center", color: c.onSurface, fontWeight: "700" },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  distRowActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  distName: { color: c.onSurface, fontWeight: "700" },
  distMeta: { color: c.muted, fontSize: 12, marginTop: 2 },
  distAssigned: { flexDirection: "row", gap: 8, alignItems: "center", padding: spacing.md, backgroundColor: c.brandTertiary, borderRadius: radius.md },
  distAssignedText: { color: c.onBrandTertiary, fontWeight: "700" },
  notes: {
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    color: c.onSurface,
  },
  totals: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { color: c.muted },
  totalValue: { color: c.onSurface, fontWeight: "600" },
  grandLabel: { color: c.onSurface, fontWeight: "800", fontSize: 16 },
  grandValue: { color: c.onSurface, fontWeight: "800", fontSize: 18 },
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
  primaryBtn: {
    backgroundColor: c.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  center: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: c.onSurface, fontWeight: "700" },
}));
