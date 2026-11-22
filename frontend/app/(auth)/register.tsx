import { useRouter, Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Distributor } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

export default function Register() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { signUp } = useAuth();

  const [gstin, setGstin] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"retailer" | "distributor">("retailer");
  const [assignedDistributorId, setAssignedDistributorId] = useState<string | null>(null);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Public distributor list for a retailer to pick. Requires auth; skip gracefully if blocked.
    (async () => {
      try {
        const res = await api.distributors();
        setDistributors(res.distributors);
      } catch {
        /* no-op: user will be able to set it after login too */
      }
    })();
  }, []);

  async function submit() {
    setErr(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signUp({
        gstin: gstin.trim().toUpperCase(),
        password,
        name: name.trim(),
        email: email.trim(),
        business_name: businessName.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        assigned_distributor_id: role === "retailer" && assignedDistributorId ? assignedDistributorId : undefined,
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>AAROHMM · Pad</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Register with your GST number. Role is Retailer or Distributor — Admin is auto-assigned.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.segment}>
            <Pressable
              testID="register-role-retailer"
              onPress={() => setRole("retailer")}
              style={[styles.segmentBtn, role === "retailer" && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, role === "retailer" && styles.segmentTextActive]}>Retailer</Text>
            </Pressable>
            <Pressable
              testID="register-role-distributor"
              onPress={() => setRole("distributor")}
              style={[styles.segmentBtn, role === "distributor" && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, role === "distributor" && styles.segmentTextActive]}>Distributor</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>GST Number</Text>
          <TextInput
            testID="register-gstin-input"
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="22AAAAA0000A1Z5"
            placeholderTextColor={colors.muted}
            value={gstin}
            onChangeText={setGstin}
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            testID="register-name-input"
            style={styles.input}
            placeholder="Owner / Contact name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Business Name</Text>
          <TextInput
            testID="register-business-input"
            style={styles.input}
            placeholder="Shop / Firm name"
            placeholderTextColor={colors.muted}
            value={businessName}
            onChangeText={setBusinessName}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="register-email-input"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            testID="register-phone-input"
            style={styles.input}
            keyboardType="phone-pad"
            placeholder="+91"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="register-password-input"
            style={styles.input}
            secureTextEntry
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
          />

          {role === "retailer" && distributors.length > 0 ? (
            <>
              <Text style={styles.label}>Assigned Distributor (optional)</Text>
              <View style={styles.distributorList}>
                <Pressable
                  onPress={() => setAssignedDistributorId(null)}
                  testID="register-distributor-none"
                  style={[styles.distributorChip, !assignedDistributorId && styles.distributorChipActive]}
                >
                  <Text style={[styles.distributorChipText, !assignedDistributorId && styles.distributorChipTextActive]}>
                    None yet
                  </Text>
                </Pressable>
                {distributors.map((d) => {
                  const active = assignedDistributorId === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setAssignedDistributorId(d.id)}
                      testID={`register-distributor-${d.id}`}
                      style={[styles.distributorChip, active && styles.distributorChipActive]}
                    >
                      <Text style={[styles.distributorChipText, active && styles.distributorChipTextActive]}>
                        {d.business_name || d.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {err ? (
            <Text testID="register-error" style={styles.error}>
              {err}
            </Text>
          ) : null}

          <Pressable
            testID="register-submit-button"
            onPress={submit}
            disabled={busy || !gstin || !password || !name || !email}
            style={[styles.primaryBtn, (busy || !gstin || !password || !name || !email) && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" testID="link-to-login">
              <Text style={styles.footerLink}>Sign in</Text>
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  brand: { color: c.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  title: { color: c.onSurface, fontSize: 24, fontWeight: "800", marginTop: 6 },
  subtitle: { color: c.muted, marginTop: 4, fontSize: 13 },
  card: {
    backgroundColor: c.surfaceSecondary,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  label: { color: c.onSurfaceSecondary, fontSize: 12, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: c.onSurface,
    fontSize: 15,
  },
  segment: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  segmentBtnActive: { backgroundColor: c.brandPrimary },
  segmentText: { color: c.onSurfaceTertiary, fontWeight: "600" },
  segmentTextActive: { color: c.onBrandPrimary },
  distributorList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 6 },
  distributorChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  distributorChipActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  distributorChipText: { color: c.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  distributorChipTextActive: { color: c.onBrandTertiary },
  error: { color: c.error, marginTop: spacing.md, fontSize: 13 },
  primaryBtn: {
    backgroundColor: c.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: c.muted, fontSize: 13 },
  footerLink: { color: c.brandPrimary, fontSize: 13, fontWeight: "700" },
}));
