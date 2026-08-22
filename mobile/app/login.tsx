import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSession } from '../lib/session';
import { fetchAppConfig, type AppConfig } from '../lib/config';
import { openWebUrl, openWhatsAppTo } from '../lib/web';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE } from '../lib/brand';

/**
 * B2B-only login screen (Iter 98).
 *
 * The B2C flow is temporarily out of the mobile experience while we focus
 * the app on retailers. The code path (`loginCustomer`) remains in
 * `lib/session.ts` so re-enabling later is a one-flag flip.
 *
 * Existing retailers sign in via the exact same endpoint used by
 * `/retailer/login` on the web: POST /api/retailer-auth/login with
 * `{email|username, password}`.
 */
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { loginRetailer } = useSession();

  useEffect(() => {
    fetchAppConfig().then(setConfig).catch(() => { /* offline is fine */ });
  }, []);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await loginRetailer(identifier.trim(), password);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Login failed';
      let msg = raw;
      if (/403/.test(raw) && /portal is currently unavailable/i.test(raw)) {
        msg = 'The retailer portal is temporarily paused. Message admin on WhatsApp to reactivate.';
      } else if (/401.*Retailer not found|401.*Invalid password|401.*Invalid email/i.test(raw)) {
        msg = 'Wrong email/username or password. Tap "Message admin on WhatsApp" below to reset.';
      } else if (/400.*required/i.test(raw)) {
        msg = 'Please enter your email or username above.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Retailers don't have a self-serve reset UI yet — WhatsApp admin.
  const openReset = () =>
    openWhatsAppTo(
      '918377020402',
      `Hi, I'm a ${MOBILE_BRAND_NAME} retailer and need help resetting my B2B password. My registered email/username is: `,
    );

  const openRetailerSignup = () => openWebUrl('/');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.container} testID="login-screen">
        <View style={styles.header}>
          <View style={styles.haloBg} pointerEvents="none" />
          <Text style={styles.brand} testID="login-brand-name">{MOBILE_BRAND_NAME}</Text>
          <View style={styles.brandRule} />
          <Text style={styles.tagline}>{MOBILE_BRAND_TAGLINE}</Text>
          <Text style={styles.b2bBadge}>· For Retailers ·</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Retailer Sign-in</Text>
          <Text style={styles.cardSub}>Use the same credentials you use on centraders.com</Text>

          <Text style={styles.label}>Email or username</Text>
          <TextInput
            testID="login-identifier"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
            placeholder="retailer@shop.com"
            placeholderTextColor="#a89f8b"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#a89f8b"
          />

          {error ? (
            <Text style={styles.error} testID="login-error">{error}</Text>
          ) : null}

          <Pressable
            testID="login-submit"
            style={({ pressed }) => [styles.cta, (submitting || pressed) && styles.ctaPressed]}
            onPress={submit}
            disabled={submitting || !identifier || !password}
            android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
          >
            {submitting ? (
              <ActivityIndicator color="#d4af37" />
            ) : (
              <Text style={styles.ctaText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable
            testID="forgot-password-link"
            onPress={openReset}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.1)' }}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotTxt}>Message admin on WhatsApp</Text>
          </Pressable>
        </View>

        <View style={styles.signupBlock}>
          <Text style={styles.signupPrompt}>Own a shop and want to stock our fragrances?</Text>
          <Pressable
            testID="signup-link"
            onPress={openRetailerSignup}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
          >
            <Text style={styles.signupLink}>
              Start retailer onboarding on centraders.com →
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Onboarding + payments happen on the web · the mobile app is your quick catalogue + cart companion.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e3a52' },
  container: { padding: 24, gap: 18, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 6, position: 'relative', paddingVertical: 12 },
  haloBg: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    top: -60,
  },
  brand: {
    fontFamily: SERIF,
    fontSize: 46,
    fontWeight: '700',
    color: '#f4e7c1',
    letterSpacing: 3,
    textAlign: 'center',
  },
  brandRule: {
    width: 72,
    height: 2,
    backgroundColor: '#d4af37',
    marginVertical: 12,
  },
  tagline: {
    fontFamily: SERIF,
    fontSize: 14,
    color: '#e8dcc1',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  b2bBadge: {
    marginTop: 8,
    fontSize: 10,
    color: '#d4af37',
    letterSpacing: 3,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#faf7f2',
    padding: 22,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  cardTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
    color: '#1e3a52',
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 12,
    color: '#6b6357',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 11,
    color: '#6b6357',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8cfbc',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1e3a52',
    backgroundColor: '#fff',
  },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 6 },
  cta: {
    marginTop: 18,
    backgroundColor: '#1e3a52',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#d4af37',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  forgotTxt: {
    fontSize: 13,
    color: '#1e3a52',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  signupBlock: { alignItems: 'center', gap: 6, marginTop: 4 },
  signupPrompt: { fontSize: 12, color: '#c8bfa9', textAlign: 'center' },
  signupLink: {
    fontSize: 13,
    color: '#d4af37',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    fontSize: 10,
    color: '#8a8272',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
});
