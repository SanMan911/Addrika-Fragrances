import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const distQ = useQuery({
    queryKey: ["distributors"],
    queryFn: () => api.distributors().then((r) => r.distributors),
    enabled: picking,
  });

  useEffect(() => {
    if (!user) router.replace("/(auth)/login");
  }, [user, router]);

  if (!user) return null;

  async function setDistributor(id: string | null) {
    setBusy(true);
    try {
      await api.setDistributor(user!.id, id);
      await refresh();
      setPicking(false);
    } catch (e) {
      /* no-op toast */
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top }]} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.name || user.gstin).charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name} testID="profile-name">{user.name}</Text>
        <Text style={styles.sub}>{user.business_name || "—"}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.rolePillText} testID="profile-role">{user.role.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>GSTIN</Text>
        <Text style={styles.value} testID="profile-gstin">{user.gstin}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user.email || "—"}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{user.phone || "—"}</Text>
      </View>

      {user.role === "retailer" && (
        <View style={styles.field}>
          <Text style={styles.label}>Assigned Distributor</Text>
          <Text style={styles.value}>
            {user.assigned_distributor_id ? user.assigned_distributor_id : "Not set"}
          </Text>
          <Pressable testID="pick-distributor-button" onPress={() => setPicking((p) => !p)} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{picking ? "Close" : user.assigned_distributor_id ? "Change" : "Pick distributor"}</Text>
          </Pressable>

          {picking && (
            <View style={{ marginTop: spacing.sm }}>
              {distQ.isLoading ? (
                <ActivityIndicator color={colors.brandPrimary} />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Pressable
                    testID="distributor-pick-none"
                    onPress={() => setDistributor(null)}
                    disabled={busy}
                    style={styles.distRow}
                  >
                    <Text style={styles.distName}>Clear assignment</Text>
                  </Pressable>
                  {(distQ.data ?? []).map((d) => (
                    <Pressable
                      key={d.id}
                      testID={`distributor-pick-${d.id}`}
                      onPress={() => setDistributor(d.id)}
                      disabled={busy}
                      style={styles.distRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.distName}>{d.business_name || d.name}</Text>
                        <Text style={styles.distMeta}>{d.gstin}</Text>
                      </View>
                      {user.assigned_distributor_id === d.id && (
                        <MaterialDesignIcons name="check" size={18} color={colors.success} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <Pressable testID="signout-button" onPress={() => signOut().then(() => router.replace("/(auth)/login"))} style={styles.signOutBtn}>
        <MaterialDesignIcons name="logout" size={18} color={colors.onError} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { color: c.onSurface, fontSize: 22, fontWeight: "800", marginBottom: spacing.md },
  card: {
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: c.onBrandPrimary, fontSize: 24, fontWeight: "800" },
  name: { color: c.onSurface, fontSize: 18, fontWeight: "800", marginTop: 10 },
  sub: { color: c.muted, fontSize: 13, marginTop: 2 },
  rolePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
    marginTop: spacing.sm,
  },
  rolePillText: { color: c.onBrandTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  field: {
    padding: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.sm,
  },
  label: { color: c.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  value: { color: c.onSurface, fontSize: 15, fontWeight: "600", marginTop: 4 },
  outlineBtn: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    alignItems: "center",
  },
  outlineBtnText: { color: c.brandPrimary, fontWeight: "700" },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  distName: { color: c.onSurface, fontWeight: "700" },
  distMeta: { color: c.muted, fontSize: 12, marginTop: 2 },
  signOutBtn: {
    marginTop: spacing.xl,
    backgroundColor: c.error,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  signOutText: { color: c.onError, fontWeight: "700" },
}));
