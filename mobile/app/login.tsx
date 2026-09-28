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
import { useAuth } from '../lib/auth';
import { MOBILE_BRAND_NAME, MOBILE_BRAND_TAGLINE } from '../lib/brand';
import { colors, radius, space, type } from '../lib/theme';

type Step = 'gstin' | 'code';

export default function Login() {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<Step>('gstin');
  const [gstin, setGstin] = useState('');
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [business, setBusiness] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstinReady = gstin.trim().length === 15;

  async function onSendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestCode(gstin);
      setMasked(res.masked_email ?? null);
      setBusiness(res.business_name ?? null);
      setStep('code');
    } catch (e: any) {
      setError(e?.message || 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(gstin, code);
      // The auth gate in _layout redirects once the session lands.
    } catch (e: any) {
      setError(e?.message || 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

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
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            padding: space.lg,
          }}
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
                Enter your GSTIN — it is your Aarohmm login ID. We'll email a
                one-time code to your registered address.
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
                  borderWidth: 1.5,
                  borderColor: gstinReady ? colors.gold : colors.parchmentDim,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  fontSize: 17,
                  letterSpacing: 1.4,
                  color: colors.text,
                  backgroundColor: colors.parchment,
                }}
              />
              <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.sm }}>
                {gstin.length}/15 characters
              </Text>

              {error ? (
                <Text testID="login-error" style={{ ...type.small, color: colors.danger, marginTop: space.md }}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                testID="login-send-code-btn"
                disabled={!gstinReady || busy}
                onPress={onSendCode}
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
                    Email me a code
                  </Text>
                )}
              </Pressable>
            </>
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
                <Text style={{ fontWeight: '700', color: colors.text }}>{masked}</Text>. It
                expires in about an hour.
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
                  borderWidth: 1.5,
                  borderColor: code.length === 6 ? colors.gold : colors.parchmentDim,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  fontSize: 26,
                  letterSpacing: 10,
                  textAlign: 'center',
                  color: colors.text,
                  backgroundColor: colors.parchment,
                }}
              />

              {error ? (
                <Text testID="login-error" style={{ ...type.small, color: colors.danger, marginTop: space.md }}>
                  {error}
                </Text>
              ) : null}

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
                onPress={() => {
                  setStep('gstin');
                  setCode('');
                  setError(null);
                }}
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
          Not an Aarohmm stockist yet?{'\n'}Write to contact.us@centraders.com
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
