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
import { apiFetch } from '../lib/api';
import { useRouter } from 'expo-router';
import { openWhatsAppTo, openWebUrl } from '../lib/web';
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

const COUNTRY_CODE = '+91';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { loginRetailer, loginRetailerOtp } = useSession();

  // OTP-login state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDevHint, setOtpDevHint] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const otpDigits = otpPhone.replace(/\D/g, '');

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
      } else if (/401.*Retailer not found|401.*Invalid password|401.*Invalid GSTIN|401.*Invalid email/i.test(raw)) {
        msg = 'Wrong GSTIN or password. Tap "Message admin on WhatsApp" below to reset.';
      } else if (/400.*required|400.*valid 15-character GSTIN|400.*not your email/i.test(raw)) {
        msg = 'Enter your 15-character GSTIN above (not your email).';
      } else if (/429/.test(raw)) {
        msg = 'Too many failed attempts. Try again in 15 minutes or reset your password.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendLoginOtp() {
    if (otpDigits.length !== 10) { setError('Enter your registered 10-digit mobile number'); return; }
    setError(null);
    setSendingOtp(true);
    try {
      const data = await apiFetch<{ dev_mode?: boolean; dev_code?: string }>(
        '/api/retailer-auth/phone/login-send-otp',
        { method: 'POST', body: JSON.stringify({ country_code: COUNTRY_CODE, phone: otpDigits }) }
      );
      setOtpSent(true);
      setOtpDevHint(data.dev_mode && data.dev_code ? String(data.dev_code) : '');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not send OTP';
      setError(/404/.test(raw)
        ? 'No account is registered with this number. Tap "Register" below.'
        : raw);
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyLoginOtp() {
    if (otpCode.length < 4) { setError('Enter the code sent to your phone'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await loginRetailerOtp(COUNTRY_CODE, otpDigits, otpCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Retailers don't have a self-serve reset UI yet — WhatsApp admin.
  const openReset = () =>
    openWhatsAppTo(
      '918377020402',
      `Hi, I'm a ${MOBILE_BRAND_NAME} retailer and need help resetting my B2B password. My GSTIN is: `,
    );

  const openRetailerSignup = () => router.push('/register');

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

          {/* Mode toggle: password vs OTP */}
          <View style={styles.toggleRow} testID="login-mode-toggle">
            <Pressable
              testID="login-mode-password"
              onPress={() => { setMode('password'); setError(null); }}
              style={[styles.toggleBtn, mode === 'password' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleTxt, mode === 'password' && styles.toggleTxtActive]}>Password</Text>
            </Pressable>
            <Pressable
              testID="login-mode-otp"
              onPress={() => { setMode('otp'); setError(null); }}
              style={[styles.toggleBtn, mode === 'otp' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleTxt, mode === 'otp' && styles.toggleTxtActive]}>OTP on phone</Text>
            </Pressable>
          </View>

          {mode === 'password' ? (
            <>
              <Text style={styles.label}>GSTIN</Text>
              <TextInput
                testID="login-identifier"
                value={identifier}
                onChangeText={(t) => setIdentifier(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={15}
                style={styles.input}
                placeholder="27ABCDE1234F1Z5"
                placeholderTextColor="#a89f8b"
              />
              <Text style={styles.hint} testID="login-identifier-hint">
                Your 15-character GSTIN is your login ID. New retailer? Tap Register below.
              </Text>

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
              <Text style={styles.hint} testID="login-password-hint">
                You set this via the invite link emailed to you after onboarding.
              </Text>

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
            </>
          ) : (
            <>
              <Text style={styles.label}>Registered mobile number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.ccBox}><Text style={styles.ccText}>{COUNTRY_CODE}</Text></View>
                <TextInput
                  testID="login-otp-phone"
                  value={otpPhone}
                  onChangeText={(t) => { setOtpPhone(t.replace(/\D/g, '').slice(0, 10)); setOtpSent(false); setOtpCode(''); setOtpDevHint(''); }}
                  keyboardType="number-pad"
                  style={[styles.input, styles.phoneInput]}
                  placeholder="10-digit number"
                  placeholderTextColor="#a89f8b"
                />
              </View>

              {!otpSent ? (
                <Pressable
                  testID="login-otp-send"
                  style={({ pressed }) => [styles.cta, (sendingOtp || pressed) && styles.ctaPressed]}
                  onPress={sendLoginOtp}
                  disabled={sendingOtp || otpDigits.length !== 10}
                >
                  {sendingOtp ? <ActivityIndicator color="#d4af37" /> : <Text style={styles.ctaText}>Send OTP</Text>}
                </Pressable>
              ) : (
                <>
                  <Text style={styles.label}>Enter code</Text>
                  <TextInput
                    testID="login-otp-code"
                    value={otpCode}
                    onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    style={[styles.input, { letterSpacing: 4 }]}
                    placeholder="6-digit code"
                    placeholderTextColor="#a89f8b"
                  />
                  {otpDevHint ? (
                    <Text style={styles.devHint} testID="login-otp-dev-hint">Dev mode: use code {otpDevHint}</Text>
                  ) : (
                    <Text style={styles.hint}>We texted a code to {COUNTRY_CODE} {otpPhone}</Text>
                  )}
                  <Pressable
                    testID="login-otp-verify"
                    style={({ pressed }) => [styles.cta, (submitting || pressed) && styles.ctaPressed]}
                    onPress={verifyLoginOtp}
                    disabled={submitting || otpCode.length < 4}
                  >
                    {submitting ? <ActivityIndicator color="#d4af37" /> : <Text style={styles.ctaText}>Verify & sign in</Text>}
                  </Pressable>
                  <Pressable testID="login-otp-resend" onPress={sendLoginOtp} disabled={sendingOtp} style={styles.forgotBtn}>
                    <Text style={styles.forgotTxt}>{sendingOtp ? 'Sending…' : 'Resend code'}</Text>
                  </Pressable>
                </>
              )}

              {error ? (
                <Text style={styles.error} testID="login-error">{error}</Text>
              ) : null}
            </>
          )}

          <Pressable
            testID="forgot-password-link"
            onPress={() => openWebUrl('/retailer/forgot-password')}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.1)' }}
            style={styles.forgotBtnProminent}
          >
            <Text style={styles.forgotTxtProminent}>Forgot password? Reset it with your GSTIN</Text>
          </Pressable>

          <Pressable
            testID="whatsapp-help-link"
            onPress={openReset}
            android_ripple={{ color: 'rgba(30, 58, 82, 0.1)' }}
            style={styles.forgotBtnProminent}
          >
            <Text style={styles.forgotTxtProminent}>Still stuck? Message admin on WhatsApp</Text>
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
              Register as a retailer →
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#efe9dd',
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
    gap: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#1e3a52' },
  toggleTxt: { fontSize: 13, fontWeight: '700', color: '#6b6357' },
  toggleTxtActive: { color: '#d4af37' },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ccBox: { borderWidth: 1, borderColor: '#d8cfbc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#f0ece3' },
  ccText: { fontSize: 15, color: '#1e3a52', fontWeight: '600' },
  phoneInput: { flex: 1 },
  devHint: { color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: '600' },
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
  forgotBtnProminent: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: 'rgba(30, 58, 82, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 82, 0.15)',
  },
  forgotTxtProminent: {
    fontSize: 14,
    color: '#1e3a52',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 11,
    color: '#8a8272',
    lineHeight: 15,
    marginTop: 4,
    fontStyle: 'italic',
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
