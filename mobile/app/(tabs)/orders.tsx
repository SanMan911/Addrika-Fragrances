import { useCallback, useEffect, useState } from 'react';

import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { apiFetch } from '../../lib/api';
import { fetchOrderYears, fetchOrders, type OrderRow } from '../../lib/data';
import { colors, inr, radius, shadow, space, type } from '../../lib/theme';

function StatusChip({ status, payment }: { status: string | null; payment: string | null }) {
  const paid = payment === 'paid';
  const cancelled = status === 'cancelled';
  const bg = cancelled ? colors.dangerBg : paid ? colors.successBg : colors.warnBg;
  const fg = cancelled ? colors.danger : paid ? colors.success : colors.warn;
  const label = cancelled ? 'Cancelled' : paid ? 'Paid' : 'Payment pending';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ ...type.small, color: fg, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export default function OrdersScreen() {

  const [years, setYears] = useState<string[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [fy, setFy] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selected: string | null) => {
    try {
      setError(null);
      const [ys, rows] = await Promise.all([
        fetchOrderYears(),
        fetchOrders(selected ?? undefined),
      ]);
      setYears(ys);
      setOrders(rows);
    } catch (e: any) {
      setError(e?.message || 'Could not load your orders.');
    }
  }, []);

  useEffect(() => {
    load(fy).finally(() => setLoading(false));
  }, [fy, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(fy);
    setRefreshing(false);
  }, [fy, load]);

  const total = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  /**
   * Pay an order through Razorpay. We ask the server for a payment link — the
   * amount comes from the stored order, never from this screen — and open it
   * in the system browser, so no native SDK is needed in the managed workflow.
   */
  async function payNow(order: OrderRow) {
    if (paying) return;
    setPaying(order.id);
    try {
      const res = await apiFetch<{ payment_url: string }>('/api/app/v2/payments/create', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ order_id: order.id }),
      });
      if (!res.payment_url) throw new Error('No payment link was returned.');
      await WebBrowser.openBrowserAsync(res.payment_url);
      // Razorpay confirms via webhook; refresh so the status catches up.
      await load(fy);
    } catch (e: any) {
      Alert.alert('Payment unavailable', e?.message || 'Please try again.');
    } finally {
      setPaying(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="orders-loading">
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }} testID="orders-screen">
      <View style={{ padding: space.md, paddingBottom: space.sm }}>
        <Text style={{ ...type.micro, color: colors.textMuted }}>FINANCIAL YEAR</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Pressable
            testID="orders-fy-all"
            onPress={() => setFy(null)}
            style={{
              backgroundColor: fy === null ? colors.navy : colors.white,
              borderRadius: radius.pill,
              paddingHorizontal: space.md,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: fy === null ? colors.navy : colors.parchmentDim,
            }}
          >
            <Text style={{ ...type.small, fontWeight: '700', color: fy === null ? colors.gold : colors.text }}>
              All years
            </Text>
          </Pressable>
          {years.map((y) => (
            <Pressable
              key={y}
              testID={`orders-fy-${y}`}
              onPress={() => setFy(y)}
              style={{
                backgroundColor: fy === y ? colors.navy : colors.white,
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: fy === y ? colors.navy : colors.parchmentDim,
              }}
            >
              <Text style={{ ...type.small, fontWeight: '700', color: fy === y ? colors.gold : colors.text }}>
                FY {y}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text testID="orders-summary" style={{ ...type.small, color: colors.textMuted, marginTop: space.md }}>
          {orders.length} order{orders.length === 1 ? '' : 's'} · {inr(total)} billed
          {fy ? ` in FY ${fy}` : ' all time'}
        </Text>
      </View>

      {error ? (
        <Text testID="orders-error" style={{ ...type.small, color: colors.danger, paddingHorizontal: space.md }}>
          {error}
        </Text>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: space.md, paddingTop: 0, paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />
        }
        ListEmptyComponent={
          <Text
            testID="orders-empty"
            style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: space.xl }}
          >
            No orders {fy ? `in FY ${fy}` : 'yet'}.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            testID={`order-card-${item.order_number}`}
            style={{
              backgroundColor: colors.white,
              borderRadius: radius.md,
              padding: space.md,
              marginBottom: space.sm,
              ...shadow.card,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.h2, color: colors.text }}>{item.order_number}</Text>
                <Text style={{ ...type.small, color: colors.textMuted, marginTop: 2 }}>
                  {item.placed_at
                    ? new Date(item.placed_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                  {item.fy ? ` · FY ${item.fy}` : ''}
                </Text>
              </View>
              <Text style={{ ...type.h2, color: colors.navy }}>{inr(item.total_amount)}</Text>
            </View>
            <View style={{ marginTop: space.sm, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <StatusChip status={item.status} payment={item.payment_status} />
              <Text style={{ ...type.small, color: colors.textMuted }}>
                {(item.items || []).length} line{(item.items || []).length === 1 ? '' : 's'}
              </Text>
            </View>
            {item.payment_status !== 'paid' && item.status !== 'cancelled' ? (
              <Pressable
                testID={`order-pay-${item.order_number}`}
                onPress={() => payNow(item)}
                disabled={paying === item.id}
                style={{
                  marginTop: space.md,
                  backgroundColor: colors.navy,
                  borderRadius: radius.pill,
                  paddingVertical: space.sm + 4,
                  alignItems: 'center',
                }}
              >
                {paying === item.id ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <Text style={{ ...type.label, color: colors.gold }}>
                    Pay {inr(item.total_amount)} now
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
