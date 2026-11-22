import { useRouter, Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { makeStyles, spacing, radius, useTheme } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { signIn } = useAuth();
  const [gstin, setGstin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      await signIn(gstin.trim().toUpperCase(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1640775670963-7d5d67de6bcc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwzfHxpbmNlbnNlJTIwc3RpY2tzJTIwbmF0dXJhbHxlbnwwfHx8fDE3OTUwOTI0NDF8MA&ixlib=rb-4.1.0&q=85",
            }}
            style={styles.hero}
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroText}>
            <Text style={styles.brand}>AAROHMM</Text>
            <Text style={styles.tagline}>Natural Incense · B2B Pad</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with your GSTIN to punch orders</Text>

          <Text style={styles.label}>GST Number</Text>
          <TextInput
            testID="login-gstin-input"
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="22AAAAA0000A1Z5"
            placeholderTextColor={colors.muted}
            value={gstin}
            onChangeText={setGstin}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
          />

          {err ? (
            <Text testID="login-error" style={styles.error}>
              {err}
            </Text>
          ) : null}

          <Pressable
            testID="login-submit-button"
            onPress={submit}
            disabled={busy || !gstin || !password}
            style={[styles.primaryBtn, (busy || !gstin || !password) && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to Aarohmm Pad? </Text>
            <Link href="/(auth)/register" testID="link-to-register">
              <Text style={styles.footerLink}>Register</Text>
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingBottom: spacing.xxl },
  heroWrap: { height: 200, width: "100%", position: "relative" },
  hero: { width: "100%", height: "100%" },
  heroOverlay: {
    position: "absolute",
    inset: 0 as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,27,26,0.35)",
  },
  heroText: { position: "absolute", left: spacing.lg, bottom: spacing.lg },
  brand: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: 3 },
  tagline: { color: "#FFFFFF", opacity: 0.9, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: c.surfaceSecondary,
    marginTop: -24,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: { color: c.onSurfaceSecondary, fontSize: 22, fontWeight: "700" },
  subtitle: { color: c.muted, marginTop: 4, marginBottom: spacing.lg },
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
