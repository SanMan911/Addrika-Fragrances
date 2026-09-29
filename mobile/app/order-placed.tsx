import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { colors, radius, space, type } from '../lib/theme';

export default function OrderPlaced() {
  const { orderId, payOrderId, amount } = useLocalSearchParams<{
    orderId?: string;
    payOrderId?: string;
    amount?: string;
  }>();
  const router = useRouter();

  return (
    <View
      testID="order-placed-screen"
      style={{
        flex: 1,
        backgroundColor: colors.navy,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
      }}
    >
      <View
        style={{
          width: 78,
          height: 78,
          borderRadius: radius.pill,
          backgroundColor: colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FontAwesome name="check" size={34} color={colors.ink} />
      </View>

      <Text style={{ ...type.display, color: colors.parchment, marginTop: space.lg, textAlign: 'center' }}>
        Order received
      </Text>
      <Text
        style={{
          ...type.body,
          color: colors.textOnDarkMuted,
          textAlign: 'center',
          marginTop: space.sm,
          lineHeight: 22,
        }}
      >
        Our team is confirming stock and will email your invoice shortly.
      </Text>

      {orderId ? (
        <View
          testID="order-placed-number"
          style={{
            marginTop: space.lg,
            backgroundColor: colors.navySoft,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
          }}
        >
          <Text style={{ ...type.micro, color: colors.gold, textAlign: 'center' }}>
            ORDER NUMBER
          </Text>
          <Text
            style={{
              ...type.h1,
              color: colors.parchment,
              marginTop: 4,
              letterSpacing: 0.5,
              textAlign: 'center',
            }}
          >
            {orderId}
          </Text>
        </View>
      ) : null}

      <Pressable
        testID="order-placed-pay-btn"
        onPress={() =>
          router.replace({
            pathname: '/pay',
            params: { orderId: payOrderId || orderId, orderNumber: orderId, amount },
          })
        }
        style={{
          marginTop: space.xl,
          backgroundColor: colors.gold,
          borderRadius: radius.pill,
          paddingHorizontal: space.xl,
          paddingVertical: space.md,
        }}
      >
        <Text style={{ ...type.label, fontSize: 15, color: colors.ink }}>Pay now</Text>
      </Pressable>

      <Pressable
        testID="order-placed-orders-btn"
        onPress={() => router.replace('/orders')}
        style={{ marginTop: space.md, paddingVertical: space.sm }}
      >
        <Text style={{ ...type.small, color: colors.textOnDarkMuted, fontWeight: '600' }}>
          View my orders
        </Text>
      </Pressable>

      <Pressable
        testID="order-placed-stock-btn"
        onPress={() => router.replace('/')}
        style={{ marginTop: space.md, paddingVertical: space.sm }}
      >
        <Text style={{ ...type.small, color: colors.textOnDarkMuted, fontWeight: '600' }}>
          Back to stock
        </Text>
      </Pressable>
    </View>
  );
}
