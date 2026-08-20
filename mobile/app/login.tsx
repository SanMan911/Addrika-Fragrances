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
import { openCustomerSignup, openRetailerSignup, openWebUrl, openWhatsAppTo } from '../lib/web';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE } from '../lib/brand';

type Tab = 'customer' | 'retailer';

export default function LoginScreen() {
  const [tab, setTab] = useState<Tab>('customer');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { loginCustomer, loginRetailer } = useSession();

  useEffect(() => {
    fetchAppConfig().then(setConfig).catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      if (tab === 'customer') await loginCustomer(identifier.trim(), password);
      else await loginRetailer(identifier.trim(), password);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Login failed';
      // Friendlier copy for the two 4xx responses the backend actually returns.
      let msg = raw;
      if (/401.*Invalid credentials/i.test(raw)) {
        msg = tab === 'customer'
          ? 'Wrong email/username or password. Tap "Forgot password" below — reset uses your registered mobile number.'
          : 'Wrong email/username or password. Tap "Message admin on WhatsApp" below.';
      } else if (/400.*Google login/i.test(raw)) {
        msg = 'This account uses Google sign-in. Please sign in via centraders.com in your browser.';
      } else if (/401.*Retailer not found|401.*Invalid password/i.test(raw)) {
        msg = 'Retailer login failed. Check your email/username and password, or message admin to reset.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Customers self-serve via /forgot-password (mobile-number OTP flow).
  // Retailers don't have a self-serve reset UI yet — on prod /retailer/login
  // is the "coming soon" waitlist gate — so we open the WhatsApp app to the
  // admin line with a pre-composed reset request instead of dead-ending.
  const openForgotPassword = () => {
    if (tab === 'customer') return openWebUrl('/forgot-password');
    return openWhatsAppTo(
      '918377020402',
      `Hi, I'm a ${MOBILE_BRAND_NAME} retailer and need help resetting my B2B password. My registered email/username is: `,
    );
  };

  const brand = MOBILE_BRAND_NAME;
  const tagline = MOBILE_BRAND_TAGLINE;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.container} testID="login-screen">
        <View style={styles.header}>
          <Text style={styles.brand} testID="login-brand-name">{brand}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <View style={styles.tabs}>
          <TabBtn label="Customer" active={tab === 'customer'} onPress={() => setTab('customer')} tid="tab-customer" />
          <TabBtn label="Retailer" active={tab === 'retailer'} onPress={() => setTab('retailer')} tid="tab-retailer" />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{tab === 'customer' ? 'Email or username' : 'Retailer email or username'}</Text>
          <TextInput
            testID="login-identifier"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
            placeholder={tab === 'customer' ? 'you@email.com' : 'retailer@shop.com'}
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
            onPress={openForgotPassword}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.1)' }}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotTxt}>
              {tab === 'customer' ? 'Forgot password?' : 'Message admin on WhatsApp'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.signupBlock}>
          <Text style={styles.signupPrompt}>
            {tab === 'customer' ? `New to ${brand}?` : 'Own a shop and want to stock our fragrances?'}
          </Text>
          <Pressable
            testID="signup-link"
            onPress={tab === 'customer' ? openCustomerSignup : openRetailerSignup}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
          >
            <Text style={styles.signupLink}>
              {tab === 'customer' ? 'Create an account on centraders.com →' : 'Start retailer onboarding on centraders.com →'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Sign-ups happen on the web — the mobile app is your quick catalogue + cart companion.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TabBtn({ label, active, onPress, tid }: { label: string; active: boolean; onPress: () => void; tid: string }) {
  return (
    <Pressable
      testID={tid}
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e3a52' },
  container: { padding: 24, gap: 20, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 8 },
  brand: { fontSize: 42, fontWeight: '700', color: '#d4af37', letterSpacing: 1 },
  tagline: { fontSize: 13, color: '#c8bfa9', marginTop: 4, fontStyle: 'italic' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#d4af37' },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#c8bfa9' },
  tabLabelActive: { color: '#1e3a52' },
  card: {
    backgroundColor: '#faf7f2',
    padding: 20,
    borderRadius: 14,
    gap: 8,
  },
  label: { fontSize: 12, color: '#6b6357', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d8cfbc',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1e3a52',
    backgroundColor: '#fff',
  },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 4 },
  cta: {
    marginTop: 16,
    backgroundColor: '#1e3a52',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#d4af37', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  forgotBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  forgotTxt: { fontSize: 13, color: '#1e3a52', fontWeight: '600', textDecorationLine: 'underline' },
  signupBlock: { alignItems: 'center', gap: 6, marginTop: 4 },
  signupPrompt: { fontSize: 13, color: '#c8bfa9' },
  signupLink: { fontSize: 14, color: '#d4af37', fontWeight: '600' },
  footer: { fontSize: 11, color: '#8a8272', textAlign: 'center', marginTop: 12 },
});
