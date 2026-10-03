import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../lib/auth';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE, WEB_URL } from '../lib/brand';
import { colors, radius, space, type } from '../lib/theme';

type Step = 'gstin' | 'password' | 'register' | 'code';

const inputStyle = {
  borderWidth: 1.5,
  borderRadius: radius.md,
  paddingHorizontal: space.md,
  paddingVertical: space.md,
  color: colors.text,
  backgroundColor: colors.parchment,
} as const;

export default function Login() {
  const { checkGstin, passwordLogin, requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<Step>('gstin');
  const [gstin, setGstin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [business, setBusiness] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstinReady = gstin.trim().length === 15;

  function reset(to: Step) {
    setStep(to);
    setPassword('');
    setCode('');
    setError(null);
  }

  async function openWeb(path: string) {
    await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
  }

  // Step 1 — does this GSTIN belong to a registered stockist?
  async function onContinue() {
    if (!gstinReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await checkGstin(gstin);
      setBusiness(res.business_name ?? null);
      if (!res.registered) {
        setStep('register');
        return;
      }
      if (!res.has_password) {
        // Admin-created account that never set a password — email route only.
        const sent = await requestCode(gstin);
        setMasked(sent.masked_email ?? null);
        setStep('code');
        return;
      }
      setStep('password');
    } catch (e: any) {
      setError(e?.message || 'Could not check that GSTIN.');
    } finally {
      setBusy(false);
    }
  }

  async function onPasswordLogin() {
    if (password.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await passwordLogin(gstin, password);
      // The auth gate in _layout redirects once the session lands.
    } catch (e: any) {
      setError(e?.message || 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  async function onSendCode() {
    if (!gstinReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestCode(gstin);
      setMasked(res.masked_email ?? null);
      setBusiness(res.business_name ?? business);
      setStep('code');
    } catch (e: any) {
      setError(e?.message || 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyCode(gstin, code);
    } catch (e: any) {
      setError(e?.message || 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  const errorNode = error ? (
    <Text testID="login-error" style={{ ...type.small, color: colors.danger, marginTop: space.md }}>
      {error}
    </Text>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.navy }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: space.lg, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: space.xl }}>
          <Text style={{ ...type.micro, color: colors.gold, marginBottom: space.sm }}>
            WHOLESALE PARTNER PORTAL
          </Text>
          <Text style={{ ...type.display, color: colors.parchment }}>{MOBILE_BRAND_NAME}</Text>
          <Text style={{ ...type.body, color: colors.textOnDarkMuted, marginTop: space.xs }}>
            {MOBILE_BRAND_TAGLINE}
          </Text>
        </View>

        <View
          style={{ backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg }}
          testID="login-card"
        >
          {step === 'gstin' ? (
            <>
              <Text style={{ ...type.h2, color: colors.text }}>Sign in</Text>
              <Text
                style={{
                  ...type.small,
                  color: colors.textMuted,
                  marginTop: space.xs,
                  marginBottom: space.lg,
                  lineHeight: 18,
                }}
              >
                Enter your GSTIN — it is your {MOBILE_BRAND_NAME} login ID. New to us? We&apos;ll
                take you straight to registration.
              </Text>

              <Text style={{ ...type.label, color: colors.text, marginBottom: space.sm }}>
                GSTIN
              </Text>
              <TextInput
                testID="login-gstin-input"
                value={gstin}
                onChangeText={(t) => setGstin(t.toUpperCase().replace(/\s/g, '').slice(0, 15))}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="29AAAAA0000A1Z5"
                placeholderTextColor="#b4ada0"
                maxLength={15}
                style={{
                  ...inputStyle,
                  borderColor: gstinReady ? colors.gold : colors.parchmentDim,
                  fontSize: 17,
                  letterSpacing: 1.4,
                }}
              />
              <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.sm }}>
                {gstin.length}/15 characters
              </Text>

              {errorNode}

              <Pressable
                testID="login-continue-btn"
                disabled={!gstinReady || busy}
                onPress={onContinue}
                style={{
                  marginTop: space.lg,
                  backgroundColor: gstinReady ? colors.navy : colors.parchmentDim,
                  borderRadius: radius.pill,
                  paddingVertical: space.md + 2,
                  alignItems: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <Text
                    style={{
                      ...type.label,
                      fontSize: 15,
                      color: gstinReady ? colors.gold : colors.textMuted,
                    }}
                  >
                    Continue
                  </Text>
                )}
              </Pressable>
            </>
          ) : step === 'password' ? (
            <>
              <Text style={{ ...type.h2, color: colors.text }}>Welcome back</Text>
              {business ? (
                <Text
                  testID="login-business-name"
                  style={{ ...type.label, color: colors.navy, marginTop: space.sm }}
                >
                  {business}
                </Text>
              ) : null}
              <Text
                style={{
                  ...type.small,
                  color: colors.textMuted,
                  marginTop: space.xs,
                  marginBottom: space.lg,
                  lineHeight: 18,
                }}
              >
                Enter the same password you use on centraders.com.
              </Text>

              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Your password"
                placeholderTextColor="#b4ada0"
                style={{
                  ...inputStyle,
                  borderColor: password ? colors.gold : colors.parchmentDim,
                  fontSize: 17,
                }}
              />

              {errorNode}

              <Pressable
                testID="login-password-submit"
                disabled={!password || busy}
                onPress={onPasswordLogin}
                style={{
                  marginTop: space.lg,
                  backgroundColor: password ? colors.navy : colors.parchmentDim,
                  borderRadius: radius.pill,
                  paddingVertical: space.md + 2,
                  alignItems: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <Text
                    style={{
                      ...type.label,
                      fontSize: 15,
                      color: password ? colors.gold : colors.textMuted,
                    }}
                  >
                    Sign in
                  </Text>
                )}
              </Pressable>

              <Pressable
                testID="login-email-code-btn"
                onPress={onSendCode}
                style={{ marginTop: space.md, alignItems: 'center' }}
              >
                <Text style={{ ...type.small, color: colors.navy, fontWeight: '600' }}>
                  Email me a one-time code instead
                </Text>
              </Pressable>

              <Pressable
                testID="login-forgot-password-btn"
                onPress={() => openWeb('/retailer/forgot-password')}
                style={{ marginTop: space.sm, alignItems: 'center' }}
              >
                <Text style={{ ...type.small, color: colors.textMuted }}>Forgot password?</Text>
              </Pressable>

              <Pressable
                testID="login-change-gstin-btn"
                onPress={() => reset('gstin')}
                style={{ marginTop: space.md, alignItems: 'center' }}
              >
                <Text style={{ ...type.small, color: colors.navy, fontWeight: '600' }}>
                  Use a different GSTIN
                </Text>
              </Pressable>
            </>
          ) : step === 'register' ? (
            <View testID="login-not-registered">
              <Text style={{ ...type.h2, color: colors.text }}>You&apos;re not a stockist yet</Text>
              <Text
                style={{
                  ...type.small,
                  color: colors.textMuted,
                  marginTop: space.sm,
                  marginBottom: space.lg,
                  lineHeight: 19,
                }}
              >
                We couldn&apos;t find an {MOBILE_BRAND_NAME} account for{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>{gstin}</Text>. Register as
                a brand partner — we verify your GSTIN instantly and email you a code to confirm
                it&apos;s really you.
              </Text>

              <Pressable
                testID="login-register-btn"
                onPress={() => openWeb('/retailer/register')}
                style={{
                  backgroundColor: colors.navy,
                  borderRadius: radius.pill,
                  paddingVertical: space.md + 2,
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...type.label, fontSize: 15, color: colors.gold }}>
                  Register as a stockist
                </Text>
              </Pressable>

              <Pressable
                testID="login-change-gstin-btn"
                onPress={() => reset('gstin')}
                style={{ marginTop: space.md, alignItems: 'center' }}
              >
                <Text style={{ ...type.small, color: colors.navy, fontWeight: '600' }}>
                  Try a different GSTIN
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ ...type.h2, color: colors.text }}>Enter your code</Text>
              {business ? (
                <Text style={{ ...type.label, color: colors.navy, marginTop: space.sm }}>
                  {business}
                </Text>
              ) : null}
              <Text
                style={{
                  ...type.small,
                  color: colors.textMuted,
                  marginTop: space.xs,
                  marginBottom: space.lg,
                  lineHeight: 18,
                }}
              >
                We sent a 6-digit code to{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>{masked}</Text>. It expires
                in about an hour.
              </Text>

              <TextInput
                testID="login-code-input"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor="#b4ada0"
                maxLength={6}
                style={{
                  ...inputStyle,
                  borderColor: code.length === 6 ? colors.gold : colors.parchmentDim,
                  fontSize: 26,
                  letterSpacing: 10,
                  textAlign: 'center',
                }}
              />

              {errorNode}

              <Pressable
                testID="login-verify-btn"
                disabled={code.length !== 6 || busy}
                onPress={onVerify}
                style={{
                  marginTop: space.lg,
                  backgroundColor: code.length === 6 ? colors.navy : colors.parchmentDim,
                  borderRadius: radius.pill,
                  paddingVertical: space.md + 2,
                  alignItems: 'center',
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <Text
                    style={{
                      ...type.label,
                      fontSize: 15,
                      color: code.length === 6 ? colors.gold : colors.textMuted,
                    }}
                  >
                    Verify &amp; sign in
                  </Text>
                )}
              </Pressable>

              <Pressable
                testID="login-change-gstin-btn"
                onPress={() => reset('gstin')}
                style={{ marginTop: space.md, alignItems: 'center' }}
              >
                <Text style={{ ...type.small, color: colors.navy, fontWeight: '600' }}>
                  Use a different GSTIN
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Text
          style={{
            ...type.small,
            color: colors.textOnDarkMuted,
            textAlign: 'center',
            marginTop: space.lg,
            lineHeight: 18,
          }}
        >
          Need help? Write to contact.us@centraders.com
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
