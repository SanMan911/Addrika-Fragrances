import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { apiFetch } from '../lib/api';
import { colors, inr, radius, shadow, space, type } from '../lib/theme';

type ProviderKey = 'razorpay' | 'pinelabs';

type ProviderCfg = {
  configured: boolean;
  /** Absent on older backends — treat that as "cannot collect yet". */
  ready_for_payments?: boolean;
  mode?: string;
  warnings?: string[];
};
type PayConfig = {
  providers?: Record<ProviderKey, ProviderCfg>;
  available_providers?: string[];
};

const PROVIDERS: {
  key: ProviderKey;
  name: string;
  subtitle: string;
  icon: keyof typeof FontAwesome.glyphMap;
}[] = [
  {
    key: 'razorpay',
    name: 'Razorpay',
    subtitle: 'UPI · Cards · Netbanking · Wallets',
    icon: 'bolt',
  },
  {
    key: 'pinelabs',
    name: 'Pine Labs',
    subtitle: 'UPI · Cards · Netbanking · EMI',
    icon: 'credit-card',
  },
];

export default function PayScreen() {
  const { orderId, orderNumber, amount } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    amount?: string;
  }>();
  const router = useRouter();

  const [config, setConfig] = useState<PayConfig | null>(null);
  const [provider, setProvider] = useState<ProviderKey>('razorpay');
  const [status, setStatus] = useState<{ payment_status?: string; amount?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, st] = await Promise.all([
        apiFetch<PayConfig>('/api/app/v2/payments/config', { auth: true }),
        orderId
          ? apiFetch<{ payment_status?: string; amount?: number }>(
              `/api/app/v2/payments/${orderId}`,
              { auth: true }
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      setConfig(cfg);
      if (st) setStatus(st);
      const first = (cfg.available_providers || [])[0] as ProviderKey | undefined;
      if (first) setProvider(first);
    } catch (e: any) {
      setNotice(e?.message || 'Could not load payment options.');
    }
  }, [orderId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const payable = Number(status?.amount ?? amount ?? 0);
  const paid = status?.payment_status === 'paid';

  async function onPay() {
    if (paying || !orderId) return;
    setPaying(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ payment_url?: string }>('/api/app/v2/payments/create', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ order_id: orderId, provider }),
      });
      if (!res.payment_url) throw new Error('No payment link was returned.');
      await WebBrowser.openBrowserAsync(res.payment_url);
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Please try again.';
      setNotice(msg);
      Alert.alert('Payment not started', msg);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View testID="pay-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="pay-screen"
      style={{ flex: 1, backgroundColor: colors.parchment }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
    >
      <View
        style={{
          backgroundColor: colors.navy,
          borderRadius: radius.md,
          padding: space.lg,
          ...shadow.card,
        }}
      >
        <Text style={{ ...type.micro, color: colors.gold }}>PAYING FOR</Text>
        <Text testID="pay-order-number" style={{ ...type.h1, color: colors.parchment, marginTop: 4 }}>
          {orderNumber || orderId || '—'}
        </Text>
        <Text testID="pay-amount" style={{ ...type.display, color: colors.gold, marginTop: space.sm }}>
          {inr(payable)}
        </Text>
        <Text style={{ ...type.small, color: colors.textOnDarkMuted, marginTop: 4 }}>
          Amount is calculated by Aarohmm from your confirmed order.
        </Text>
      </View>

      {paid ? (
        <View
          testID="pay-already-paid"
          style={{
            marginTop: space.md,
            backgroundColor: colors.successBg,
            borderRadius: radius.md,
            padding: space.md,
          }}
        >
          <Text style={{ ...type.label, color: colors.success }}>
            This order is already paid. Thank you!
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ ...type.micro, color: colors.textMuted, marginTop: space.lg }}>
            CHOOSE HOW YOU WANT TO PAY
          </Text>

          {PROVIDERS.map((p) => {
            const cfg = config?.providers?.[p.key];
            const ready = cfg?.ready_for_payments === true;
            const selected = provider === p.key;
            return (
              <Pressable
                key={p.key}
                testID={`pay-provider-${p.key}`}
                onPress={() => setProvider(p.key)}
                style={{
                  marginTop: space.sm,
                  backgroundColor: colors.white,
                  borderRadius: radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.navy : colors.parchmentDim,
                  padding: space.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  ...(selected ? shadow.lifted : shadow.card),
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radius.sm,
                    backgroundColor: selected ? colors.navy : colors.parchment,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FontAwesome
                    name={p.icon}
                    size={20}
                    color={selected ? colors.gold : colors.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ ...type.h2, color: colors.text }}>{p.name}</Text>
                    {!ready ? (
                      <View
                        testID={`pay-provider-${p.key}-pending`}
                        style={{
                          backgroundColor: colors.warnBg,
                          borderRadius: radius.pill,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ ...type.small, color: colors.warn, fontWeight: '700' }}>
                          Setup pending
                        </Text>
                      </View>
                    ) : cfg?.mode && cfg.mode !== 'live' ? (
                      <View
                        style={{
                          backgroundColor: colors.parchmentDim,
                          borderRadius: radius.pill,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ ...type.small, color: colors.textMuted, fontWeight: '700' }}>
                          Test mode
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ ...type.small, color: colors.textMuted, marginTop: 3 }}>
                    {p.subtitle}
                  </Text>
                </View>
                <FontAwesome
                  name={selected ? 'dot-circle-o' : 'circle-o'}
                  size={20}
                  color={selected ? colors.navy : colors.parchmentDim}
                />
              </Pressable>
            );
          })}

          {notice ? (
            <View
              testID="pay-notice"
              style={{
                marginTop: space.md,
                backgroundColor: colors.warnBg,
                borderRadius: radius.md,
                padding: space.md,
              }}
            >
              <Text style={{ ...type.small, color: colors.warn, fontWeight: '600', lineHeight: 18 }}>
                {notice}
              </Text>
            </View>
          ) : null}

          <Pressable
            testID="pay-now-btn"
            disabled={paying || !orderId}
            onPress={onPay}
            style={{
              marginTop: space.lg,
              backgroundColor: colors.navy,
              borderRadius: radius.pill,
              paddingVertical: space.md + 3,
              alignItems: 'center',
            }}
          >
            {paying ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={{ ...type.label, fontSize: 15, color: colors.gold }}>
                Pay {inr(payable)} with{' '}
                {PROVIDERS.find((p) => p.key === provider)?.name}
              </Text>
            )}
          </Pressable>
        </>
      )}

      <Pressable
        testID="pay-later-btn"
        onPress={() => router.replace('/orders')}
        style={{ marginTop: space.md, alignItems: 'center', paddingVertical: space.sm }}
      >
        <Text style={{ ...type.small, color: colors.textMuted, fontWeight: '600' }}>
          {paid ? 'Back to my orders' : 'Pay later · keep on credit terms'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
