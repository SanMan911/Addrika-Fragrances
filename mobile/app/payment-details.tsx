import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { apiFetch } from '../lib/api';
import { colors, inr, radius, shadow, space, type } from '../lib/theme';

type Proof = {
  proof_id: string;
  mode: string;
  reference: string;
  paid_on: string;
  amount: number;
  status: string;
};

const MODES: { key: string; label: string }[] = [
  { key: 'upi', label: 'UPI' },
  { key: 'net_banking', label: 'Net Banking' },
  { key: 'credit_card', label: 'Credit Card' },
  { key: 'debit_card', label: 'Debit Card' },
  { key: 'neft_rtgs', label: 'NEFT / RTGS' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'cash', label: 'Cash' },
];

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  pending: { fg: colors.warn, bg: colors.warnBg },
  verified: { fg: colors.success, bg: colors.successBg },
  rejected: { fg: colors.danger, bg: colors.dangerBg },
};

const inputStyle = {
  backgroundColor: colors.parchment,
  borderRadius: radius.sm,
  paddingHorizontal: space.md,
  paddingVertical: space.sm + 3,
  fontSize: 15,
  color: colors.text,
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentDetailsScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();

  const [mode, setMode] = useState('upi');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProofs() {
    try {
      const res = await apiFetch<{ proofs: Proof[] }>('/api/app/v2/payment-proofs', { auth: true });
      setProofs(res.proofs || []);
    } catch {
      setProofs([]);
    }
  }

  useEffect(() => {
    loadProofs().finally(() => setLoading(false));
  }, []);

  const ready = reference.trim().length >= 4 && Number(amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(paidOn);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await apiFetch('/api/app/v2/payment-proofs', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          mode,
          reference: reference.trim(),
          paid_on: paidOn,
          amount: Number(amount),
          order_id: orderId || null,
          note: note.trim() || null,
        }),
      });
      setReference('');
      setAmount('');
      setNote('');
      await loadProofs();
      Alert.alert(
        'Sent for verification',
        'Our wholesale desk will verify this payment and reopen your ordering.'
      );
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.parchment }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        testID="payment-details-screen"
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.md,
            padding: space.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...type.h2, color: colors.text }}>Tell us about your payment</Text>
          <Text style={{ ...type.small, color: colors.textMuted, marginTop: space.xs, lineHeight: 18 }}>
            Already transferred the amount? Share the details and our team will verify it against
            the bank statement.
          </Text>

          <Text style={{ ...type.label, color: colors.text, marginTop: space.lg, marginBottom: space.sm }}>
            Payment mode
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {MODES.map((m) => {
              const selected = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  testID={`proof-mode-${m.key}`}
                  onPress={() => setMode(m.key)}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: selected ? colors.navy : colors.parchment,
                    borderWidth: 1,
                    borderColor: selected ? colors.navy : colors.parchmentDim,
                  }}
                >
                  <Text
                    style={{
                      ...type.small,
                      fontWeight: '700',
                      color: selected ? colors.gold : colors.textMuted,
                    }}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Transaction / UTR / cheque number
          </Text>
          <TextInput
            testID="proof-reference-input"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder="428193756201"
            placeholderTextColor={colors.inputPlaceholder}
            style={inputStyle}
          />

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Payment date
          </Text>
          <TextInput
            testID="proof-date-input"
            value={paidOn}
            onChangeText={(t) => setPaidOn(t.replace(/[^\d-]/g, '').slice(0, 10))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inputPlaceholder}
            style={inputStyle}
          />

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Amount paid (₹)
          </Text>
          <TextInput
            testID="proof-amount-input"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="25000"
            placeholderTextColor={colors.inputPlaceholder}
            style={inputStyle}
          />

          <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
            Note (optional)
          </Text>
          <TextInput
            testID="proof-note-input"
            value={note}
            onChangeText={setNote}
            placeholder="Paid from our HDFC current account"
            placeholderTextColor={colors.inputPlaceholder}
            style={inputStyle}
          />

          <Pressable
            testID="proof-submit-btn"
            disabled={!ready || busy}
            onPress={submit}
            style={{
              marginTop: space.lg,
              backgroundColor: ready ? colors.navy : colors.parchmentDim,
              borderRadius: radius.pill,
              paddingVertical: space.md + 2,
              alignItems: 'center',
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={{ ...type.label, fontSize: 15, color: ready ? colors.gold : colors.textMuted }}>
                Send for verification
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={{ ...type.micro, color: colors.textMuted, marginTop: space.lg, marginBottom: space.sm }}>
          PAYMENTS YOU HAVE DECLARED
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.navy} />
        ) : proofs.length === 0 ? (
          <Text style={{ ...type.small, color: colors.textMuted }}>Nothing submitted yet.</Text>
        ) : (
          proofs.map((p) => {
            const palette = STATUS_COLOR[p.status] || STATUS_COLOR.pending;
            return (
              <View
                key={p.proof_id}
                testID={`proof-row-${p.proof_id}`}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.md,
                  padding: space.md,
                  marginBottom: space.sm,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...type.h2, color: colors.text }}>{inr(p.amount)}</Text>
                  <View
                    style={{
                      backgroundColor: palette.bg,
                      borderRadius: radius.pill,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ ...type.small, color: palette.fg, fontWeight: '700' }}>
                      {p.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={{ ...type.small, color: colors.textMuted, marginTop: 3 }}>
                  {MODES.find((m) => m.key === p.mode)?.label || p.mode} · {p.reference} · {p.paid_on}
                </Text>
              </View>
            );
          })
        )}

        <Pressable
          testID="payment-details-back"
          onPress={() => router.back()}
          style={{ marginTop: space.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: space.sm }}
        >
          <FontAwesome name="angle-left" size={18} color={colors.textMuted} />
          <Text style={{ ...type.small, color: colors.textMuted, fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
