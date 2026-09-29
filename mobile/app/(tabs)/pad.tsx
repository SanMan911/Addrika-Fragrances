import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../../lib/api';
import { usePad } from '../../lib/pad';
import { colors, inr, radius, shadow, space, type } from '../../lib/theme';

type Calc = {
  subtotal: number;
  gst_total: number;
  grand_total: number;
  tier_discount_total?: number;
  cash_discount?: number;
  shipping_charges?: number;
  scheme_discount?: number;
  applied_scheme?: {
    title: string;
    discount_percent: number;
    discount_amount: number;
  } | null;
  next_scheme?: {
    title: string;
    discount_percent: number;
    boxes_needed: number;
  } | null;
  items: any[];
};

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          ...(strong ? type.h2 : type.body),
          color: muted ? colors.textMuted : colors.text,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...(strong ? type.h2 : type.body),
          color: muted ? colors.textMuted : colors.text,
          fontWeight: strong ? '700' : '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function OrderPadScreen() {
  const { lines, setBoxes, remove, clear, indicativeSubtotal } = usePad();
  const router = useRouter();
  const [calc, setCalc] = useState<Calc | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');

  const payload = useCallback(
    () => ({
      items: lines.map((l) => ({ product_id: l.sku, quantity_boxes: l.boxes })),
      include_shipping: pincode.trim().length === 6,
      delivery_pincode: pincode.trim().length === 6 ? pincode.trim() : null,
      notes: notes.trim() || null,
    }),
    [lines, pincode, notes]
  );

  // The server is the only authority on price — recompute whenever the pad
  // or the delivery pincode changes.
  useEffect(() => {
    if (lines.length === 0) {
      setCalc(null);
      return;
    }
    let cancelled = false;
    setCalcBusy(true);
    setCalcError(null);
    apiFetch<Calc>('/api/app/v2/orders/calculate', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload()),
    })
      .then((c) => {
        if (!cancelled) setCalc(c);
      })
      .catch((e: any) => {
        if (!cancelled) setCalcError(e?.message || 'Could not price this order.');
      })
      .finally(() => {
        if (!cancelled) setCalcBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lines, pincode, payload]);

  async function onPlace() {
    if (placing || calcBusy || !calc) return;
    setPlacing(true);
    try {
      const res = await apiFetch<{ order_id: string; order_number?: string }>(
        '/api/app/v2/orders',
        {
          method: 'POST',
          auth: true,
          body: JSON.stringify({
            ...payload(),
            client_ref: `pad-${Date.now()}`,
          }),
        }
      );
      await clear();
      router.push({
        pathname: '/order-placed',
        params: {
          orderId: res.order_number || res.order_id,
          payOrderId: res.order_id,
          amount: String(calc.grand_total ?? ''),
        },
      });
    } catch (e: any) {
      Alert.alert('Order not placed', e?.message || 'Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (lines.length === 0) {
    return (
      <View
        testID="pad-empty"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}
      >
        <Text style={{ ...type.h1, color: colors.text, textAlign: 'center' }}>
          Your order pad is empty
        </Text>
        <Text
          style={{
            ...type.body,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: space.sm,
            lineHeight: 21,
          }}
        >
          Head to Stock and tap + on the fragrances you want to reorder.
        </Text>
        <Pressable
          testID="pad-browse-btn"
          onPress={() => router.push('/')}
          style={{
            marginTop: space.lg,
            backgroundColor: colors.navy,
            borderRadius: radius.pill,
            paddingHorizontal: space.xl,
            paddingVertical: space.md,
          }}
        >
          <Text style={{ ...type.label, color: colors.gold }}>Browse stock</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      testID="pad-screen"
      style={{ flex: 1, backgroundColor: colors.parchment }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
    >
      {lines.map((l) => (
        <View
          key={l.sku}
          testID={`pad-line-${l.sku}`}
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.md,
            padding: space.md,
            marginBottom: space.sm,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text style={{ ...type.h2, color: colors.text }} numberOfLines={2}>
                {l.name}
              </Text>
              <Text style={{ ...type.small, color: colors.textMuted, marginTop: 2 }}>
                {l.sizeLabel || l.sku} · {inr(l.indicativePricePerBox)}/box
              </Text>
            </View>
            <Pressable testID={`pad-remove-${l.sku}`} onPress={() => remove(l.sku)}>
              <Text style={{ ...type.small, color: colors.danger, fontWeight: '700' }}>
                Remove
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: space.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Pressable
                testID={`pad-minus-${l.sku}`}
                onPress={() =>
                  setBoxes(
                    {
                      sku: l.sku,
                      name: l.name,
                      sizeLabel: l.sizeLabel,
                      indicativePricePerBox: l.indicativePricePerBox,
                      imageUrl: l.imageUrl,
                    },
                    l.boxes - 0.5
                  )
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  backgroundColor: colors.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.gold, fontSize: 19 }}>−</Text>
              </Pressable>
              <Text style={{ ...type.h2, color: colors.text, minWidth: 44, textAlign: 'center' }}>
                {l.boxes % 1 === 0 ? l.boxes : l.boxes.toFixed(1)}
              </Text>
              <Pressable
                testID={`pad-plus-${l.sku}`}
                onPress={() =>
                  setBoxes(
                    {
                      sku: l.sku,
                      name: l.name,
                      sizeLabel: l.sizeLabel,
                      indicativePricePerBox: l.indicativePricePerBox,
                      imageUrl: l.imageUrl,
                    },
                    l.boxes + 0.5
                  )
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  backgroundColor: colors.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.gold, fontSize: 19 }}>+</Text>
              </Pressable>
              <Text style={{ ...type.small, color: colors.textMuted }}>boxes</Text>
            </View>
            <Text style={{ ...type.label, color: colors.navy }}>
              {inr(l.indicativePricePerBox * l.boxes)}
            </Text>
          </View>
        </View>
      ))}

      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radius.md,
          padding: space.md,
          marginTop: space.sm,
          ...shadow.card,
        }}
      >
        <Text style={{ ...type.label, color: colors.text, marginBottom: space.sm }}>
          Delivery pincode (optional)
        </Text>
        <TextInput
          testID="pad-pincode"
          value={pincode}
          onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="560001"
          placeholderTextColor="#b4ada0"
          style={{
            backgroundColor: colors.parchment,
            borderRadius: radius.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 3,
            fontSize: 15,
            color: colors.text,
          }}
        />
        <Text style={{ ...type.label, color: colors.text, marginTop: space.md, marginBottom: space.sm }}>
          Notes for our team (optional)
        </Text>
        <TextInput
          testID="pad-notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="e.g. deliver after Diwali week"
          placeholderTextColor="#b4ada0"
          style={{
            backgroundColor: colors.parchment,
            borderRadius: radius.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 3,
            fontSize: 15,
            color: colors.text,
            minHeight: 68,
            textAlignVertical: 'top',
          }}
        />
      </View>

      <View
        testID="pad-summary"
        style={{
          backgroundColor: colors.white,
          borderRadius: radius.md,
          padding: space.md,
          marginTop: space.md,
          ...shadow.card,
        }}
      >
        <Text style={{ ...type.micro, color: colors.textMuted, marginBottom: space.sm }}>
          PRICED BY AAROHMM
        </Text>
        {calcBusy ? (
          <ActivityIndicator color={colors.navy} />
        ) : calcError ? (
          <Text testID="pad-calc-error" style={{ ...type.small, color: colors.danger }}>
            {calcError}
          </Text>
        ) : calc ? (
          <>
            <Row label="Subtotal" value={inr(calc.subtotal)} />
            {calc.tier_discount_total ? (
              <Row label="Tier discount" value={`− ${inr(calc.tier_discount_total)}`} muted />
            ) : null}
            {calc.applied_scheme ? (
              <Row
                label={`${calc.applied_scheme.title} (${calc.applied_scheme.discount_percent}%)`}
                value={`− ${inr(calc.applied_scheme.discount_amount)}`}
                muted
              />
            ) : null}
            {calc.cash_discount ? (
              <Row label="Cash discount" value={`− ${inr(calc.cash_discount)}`} muted />
            ) : null}
            <Row label="GST" value={inr(calc.gst_total)} muted />
            {calc.shipping_charges ? (
              <Row label="Shipping" value={inr(calc.shipping_charges)} muted />
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.parchmentDim, marginVertical: space.sm }} />
            <Row label="Total payable" value={inr(calc.grand_total)} strong />
            {calc.applied_scheme ? (
              <View
                testID="pad-scheme-applied"
                style={{
                  marginTop: space.sm,
                  backgroundColor: colors.successBg,
                  borderRadius: radius.sm,
                  padding: space.sm + 2,
                }}
              >
                <Text style={{ ...type.small, color: colors.success, fontWeight: '700' }}>
                  Scheme applied · you saved {inr(calc.applied_scheme.discount_amount)}
                </Text>
              </View>
            ) : calc.next_scheme ? (
              <View
                testID="pad-scheme-nudge"
                style={{
                  marginTop: space.sm,
                  backgroundColor: colors.warnBg,
                  borderRadius: radius.sm,
                  padding: space.sm + 2,
                }}
              >
                <Text style={{ ...type.small, color: colors.warn, fontWeight: '700' }}>
                  Add {calc.next_scheme.boxes_needed} more box
                  {calc.next_scheme.boxes_needed === 1 ? '' : 'es'} to unlock{' '}
                  {calc.next_scheme.discount_percent}% off
                </Text>
                <Text style={{ ...type.small, color: colors.textMuted, marginTop: 2 }}>
                  {calc.next_scheme.title}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Row label="Indicative subtotal" value={inr(indicativeSubtotal)} muted />
        )}
      </View>

      <Pressable
        testID="pad-place-order-btn"
        disabled={placing || calcBusy || !calc}
        onPress={onPlace}
        style={{
          marginTop: space.lg,
          backgroundColor: calc && !calcBusy ? colors.navy : colors.parchmentDim,
          borderRadius: radius.pill,
          paddingVertical: space.md + 3,
          alignItems: 'center',
        }}
      >
        {placing ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <Text
            style={{
              ...type.label,
              fontSize: 15,
              color: calc && !calcBusy ? colors.gold : colors.textMuted,
            }}
          >
            Place order{calc ? ` · ${inr(calc.grand_total)}` : ''}
          </Text>
        )}
      </Pressable>

      <Pressable testID="pad-clear-btn" onPress={clear} style={{ marginTop: space.md, alignItems: 'center' }}>
        <Text style={{ ...type.small, color: colors.textMuted, fontWeight: '600' }}>
          Clear order pad
        </Text>
      </Pressable>
    </ScrollView>
  );
}
