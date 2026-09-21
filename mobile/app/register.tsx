import { useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { apiFetch, API_URL } from '../lib/api';
import { useSession } from '../lib/session';
import { openWhatsAppTo } from '../lib/web';
import { MOBILE_BRAND_NAME } from '../lib/brand';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const COUNTRY_CODE = '+91';

type Cert = { uri: string; name: string; mimeType: string; size?: number };

export default function RegisterScreen() {
  const router = useRouter();
  const { applyRetailerSession } = useSession();

  const [business, setBusiness] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gst, setGst] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cert, setCert] = useState<Cert | null>(null);

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [devHint, setDevHint] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = phone.replace(/\D/g, '');

  const onPhoneChange = (v: string) => {
    setPhone(v.replace(/\D/g, '').slice(0, 10));
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpCode('');
    setDevHint('');
  };

  async function sendOtp() {
    if (phoneDigits.length !== 10) { setError('Enter a valid 10-digit mobile number first'); return; }
    setError(null);
    setSendingOtp(true);
    try {
      const data = await apiFetch<{ dev_mode?: boolean; dev_code?: string }>(
        '/api/retailer-auth/phone/send-otp',
        { method: 'POST', body: JSON.stringify({ country_code: COUNTRY_CODE, phone: phoneDigits }) }
      );
      setOtpSent(true);
      if (data.dev_mode && data.dev_code) setDevHint(String(data.dev_code));
      else setDevHint('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (otpCode.length < 4) { setError('Enter the code sent to your phone'); return; }
    setError(null);
    setVerifyingOtp(true);
    try {
      await apiFetch('/api/retailer-auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ country_code: COUNTRY_CODE, phone: phoneDigits, code: otpCode }),
      });
      setPhoneVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function pickCertificate() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setCert({
        uri: a.uri,
        name: a.name || 'gst-certificate',
        mimeType: a.mimeType || 'application/octet-stream',
        size: a.size,
      });
    } catch {
      setError('Could not open the file picker. Please try again.');
    }
  }

  function validate(): string | null {
    if (business.trim().length < 2) return 'Enter your business name';
    if (contact.trim().length < 2) return 'Enter a contact name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'Enter a valid email';
    if (phoneDigits.length !== 10) return 'Enter a valid 10-digit phone number';
    if (!phoneVerified) return 'Verify your phone number via OTP first';
    if (!GST_RE.test(gst.toUpperCase().trim())) return 'Enter a valid 15-character GSTIN';
    if (!cert) return 'Upload your GST certificate (PDF/JPG/PNG)';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('business_name', business.trim());
      fd.append('contact_name', contact.trim());
      fd.append('email', email.trim().toLowerCase());
      fd.append('country_code', COUNTRY_CODE);
      fd.append('phone', phoneDigits);
      fd.append('gst_number', gst.toUpperCase().trim());
      fd.append('password', password);
      if (city.trim()) fd.append('city', city.trim());
      // React Native FormData file part (not a browser Blob)
      const filePart = { uri: cert!.uri, name: cert!.name, type: cert!.mimeType } as unknown as Blob;
      fd.append('gst_certificate', filePart);

      const res = await fetch(`${API_URL}/api/retailer-auth/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      if (data.token) {
        await applyRetailerSession(data.token, data.retailer?.name || business, data.retailer?.email || email);
        router.replace('/');
      } else {
        router.replace('/login');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  const helpWhatsApp = () =>
    openWhatsAppTo('918377020402', `Hi, I'm registering as an ${MOBILE_BRAND_NAME} retailer and need help.`);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} testID="register-screen" keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Retailer Registration</Text>
        <Text style={styles.sub}>Stock {MOBILE_BRAND_NAME} fragrances. Verified against your GST certificate.</Text>

        <Text style={styles.label}>Business name*</Text>
        <TextInput testID="reg-business" style={styles.input} value={business} onChangeText={setBusiness} placeholder="Shop / firm name" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>Contact name*</Text>
        <TextInput testID="reg-contact" style={styles.input} value={contact} onChangeText={setContact} placeholder="Your name" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>Email*</Text>
        <TextInput testID="reg-email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@shop.com" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>Mobile number*</Text>
        <View style={styles.phoneRow}>
          <View style={styles.ccBox}><Text style={styles.ccText}>{COUNTRY_CODE}</Text></View>
          <TextInput testID="reg-phone" style={[styles.input, styles.phoneInput]} value={phone} onChangeText={onPhoneChange} keyboardType="number-pad" placeholder="10-digit number" placeholderTextColor="#a89f8b" />
        </View>

        {/* OTP verification */}
        <View style={styles.otpBox} testID="reg-otp-box">
          {phoneVerified ? (
            <Text style={styles.verified} testID="reg-phone-verified">✓ Phone number verified</Text>
          ) : (
            <>
              <View style={styles.otpHeaderRow}>
                <Text style={styles.otpLabel}>Verify phone *</Text>
                <Pressable testID="reg-send-otp" onPress={sendOtp} disabled={sendingOtp || phoneDigits.length !== 10} style={({ pressed }) => [styles.otpBtn, (sendingOtp || pressed) && styles.pressed]}>
                  <Text style={styles.otpBtnText}>{sendingOtp ? 'Sending…' : otpSent ? 'Resend' : 'Send OTP'}</Text>
                </Pressable>
              </View>
              {otpSent && (
                <View style={styles.otpVerifyRow}>
                  <TextInput testID="reg-otp-code" style={[styles.input, styles.otpInput]} value={otpCode} onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit code" placeholderTextColor="#a89f8b" />
                  <Pressable testID="reg-verify-otp" onPress={verifyOtp} disabled={verifyingOtp || otpCode.length < 4} style={({ pressed }) => [styles.verifyBtn, (verifyingOtp || pressed) && styles.pressed]}>
                    <Text style={styles.verifyBtnText}>{verifyingOtp ? '…' : 'Verify'}</Text>
                  </Pressable>
                </View>
              )}
              {devHint ? <Text style={styles.devHint} testID="reg-otp-dev-hint">Dev mode: use code {devHint}</Text> : null}
            </>
          )}
        </View>

        <Text style={styles.label}>GSTIN*</Text>
        <TextInput testID="reg-gst" style={styles.input} value={gst} onChangeText={(t) => setGst(t.toUpperCase())} autoCapitalize="characters" maxLength={15} placeholder="15-character GST number" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>GST certificate*</Text>
        <Pressable testID="reg-cert-pick" onPress={pickCertificate} style={({ pressed }) => [styles.fileBtn, pressed && styles.pressed]}>
          <Text style={styles.fileBtnText} numberOfLines={1}>
            {cert ? `📎 ${cert.name}` : 'Tap to upload (PDF / JPG / PNG)'}
          </Text>
        </Pressable>

        <Text style={styles.label}>City</Text>
        <TextInput testID="reg-city" style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>Password*</Text>
        <TextInput testID="reg-password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 8 characters" placeholderTextColor="#a89f8b" />

        <Text style={styles.label}>Confirm password*</Text>
        <TextInput testID="reg-confirm" style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter password" placeholderTextColor="#a89f8b" />

        {error ? <Text style={styles.error} testID="reg-error">{error}</Text> : null}

        <Pressable testID="reg-submit" onPress={submit} disabled={submitting} style={({ pressed }) => [styles.cta, (submitting || pressed) && styles.pressed]}>
          {submitting ? <ActivityIndicator color="#d4af37" /> : <Text style={styles.ctaText}>Submit registration</Text>}
        </Pressable>

        <Text style={styles.note}>Your account will be under review until our team verifies your GST certificate. You can sign in meanwhile.</Text>

        <Pressable testID="reg-back-login" onPress={() => router.replace('/login')} style={styles.linkBtn}>
          <Text style={styles.link}>Already registered? Sign in</Text>
        </Pressable>
        <Pressable testID="reg-help" onPress={helpWhatsApp} style={styles.linkBtn}>
          <Text style={styles.help}>Need help? Message admin on WhatsApp</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf7f2' },
  container: { padding: 22, gap: 4, paddingBottom: 48 },
  title: { fontFamily: SERIF, fontSize: 26, fontWeight: '700', color: '#1e3a52' },
  sub: { fontSize: 13, color: '#6b6357', marginBottom: 12, fontStyle: 'italic' },
  label: { fontSize: 11, color: '#6b6357', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d8cfbc', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e3a52', backgroundColor: '#fff', marginTop: 4 },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ccBox: { borderWidth: 1, borderColor: '#d8cfbc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#f0ece3', marginTop: 4 },
  ccText: { fontSize: 15, color: '#1e3a52', fontWeight: '600' },
  phoneInput: { flex: 1 },
  otpBox: { marginTop: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', borderRadius: 10, padding: 12, backgroundColor: '#fffdf6' },
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otpLabel: { fontSize: 11, color: '#1e3a52', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  otpBtn: { backgroundColor: '#1e3a52', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  otpBtnText: { color: '#d4af37', fontWeight: '700', fontSize: 13 },
  otpVerifyRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  otpInput: { flex: 1, letterSpacing: 4 },
  verifyBtn: { backgroundColor: '#d4af37', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 8, marginTop: 4 },
  verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  verified: { color: '#15803d', fontWeight: '700', fontSize: 14 },
  devHint: { color: '#b45309', fontSize: 12, marginTop: 8 },
  fileBtn: { borderWidth: 1, borderColor: '#d8cfbc', borderStyle: 'dashed', borderRadius: 10, padding: 14, backgroundColor: '#fff', marginTop: 4 },
  fileBtnText: { color: '#1e3a52', fontSize: 14 },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 12 },
  cta: { marginTop: 20, backgroundColor: '#1e3a52', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#d4af37', fontWeight: '700', fontSize: 15, letterSpacing: 1 },
  pressed: { opacity: 0.85 },
  note: { fontSize: 11, color: '#8a8272', marginTop: 14, lineHeight: 16, fontStyle: 'italic', textAlign: 'center' },
  linkBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 6 },
  link: { color: '#1e3a52', fontWeight: '700', fontSize: 14 },
  help: { color: '#8a6d1f', fontWeight: '600', fontSize: 13 },
});
