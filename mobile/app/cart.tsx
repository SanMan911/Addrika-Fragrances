import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCart } from '../lib/cart';
import { useSession } from '../lib/session';
import { openWebCheckout } from '../lib/web';

export default function CartScreen() {
  const { lines, ready, remove, setQty, subtotal, itemCount, clear } = useCart();
  const { session } = useSession();

  if (!ready) {
    return <View style={styles.center}><Text style={styles.empty}>Loading cart…</Text></View>;
  }

  if (lines.length === 0) {
    return (
      <View style={styles.center} testID="cart-empty">
        <Text style={styles.empty}>Your cart is empty.</Text>
        <Text style={styles.hint}>Add products from the catalogue to build an order.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="cart-list"
        data={lines}
        keyExtractor={(l) => `${l.productId}-${l.size}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`cart-row-${item.productId}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.size}>{item.size} · ₹{item.priceInr}</Text>
            </View>
            <View style={styles.qtyBox}>
              <QtyBtn label="−" testID={`qty-dec-${item.productId}`} onPress={() => setQty(item.productId, item.size, item.quantity - 1)} />
              <Text style={styles.qty} testID={`qty-value-${item.productId}`}>{item.quantity}</Text>
              <QtyBtn label="+" testID={`qty-inc-${item.productId}`} onPress={() => setQty(item.productId, item.size, item.quantity + 1)} />
            </View>
            <Pressable
              testID={`cart-remove-${item.productId}`}
              onPress={() => remove(item.productId, item.size)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeTxt}>✕</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer} testID="cart-footer">
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{itemCount} items</Text>
          <Text style={styles.summaryValue} testID="cart-subtotal">₹{subtotal}</Text>
        </View>
        <Text style={styles.notice} testID="cart-checkout-notice">
          Checkout, GST invoicing and payment happen on the web —
          we'll hand your cart over to centraders.com.
        </Text>
        <Pressable
          testID="cart-checkout-btn"
          style={({ pressed }) => [styles.checkoutBtn, pressed && styles.checkoutBtnPressed]}
          android_ripple={{ color: 'rgba(212, 175, 55, 0.25)' }}
          onPress={() => openWebCheckout(lines, session?.kind ?? null)}
        >
          <Text style={styles.checkoutTxt}>
            Complete Order on centraders.com →
          </Text>
        </Pressable>
        <Pressable onPress={clear} testID="cart-clear-btn" style={styles.clearBtn}>
          <Text style={styles.clearTxt}>Clear cart</Text>
        </Pressable>
      </View>
    </View>
  );
}

function QtyBtn({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
      android_ripple={{ color: 'rgba(30, 58, 82, 0.15)' }}
    >
      <Text style={styles.qtyBtnTxt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  empty: { fontSize: 16, color: '#1e3a52', fontWeight: '600' },
  hint: { fontSize: 12, color: '#6b6357', textAlign: 'center' },
  list: { padding: 16, gap: 8, paddingBottom: 24 },
  row: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#d4af37',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  name: { fontSize: 14, color: '#1e3a52', fontWeight: '600' },
  size: { fontSize: 12, color: '#6b6357', marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qty: { fontSize: 14, color: '#1e3a52', fontWeight: '700', minWidth: 20, textAlign: 'center' },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#faf7f2',
    borderWidth: 1, borderColor: '#d4af37',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnPressed: { opacity: 0.7 },
  qtyBtnTxt: { fontSize: 16, color: '#1e3a52', fontWeight: '700' },
  removeBtn: { padding: 6 },
  removeTxt: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e6dfd0',
    padding: 20,
    backgroundColor: '#fff',
    gap: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: '#6b6357' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#1e3a52' },
  notice: {
    fontSize: 11, color: '#6b6357', backgroundColor: '#faf7f2',
    padding: 10, borderRadius: 8, lineHeight: 15,
  },
  checkoutBtn: {
    backgroundColor: '#1e3a52',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutBtnPressed: { opacity: 0.85 },
  checkoutTxt: { color: '#d4af37', fontWeight: '700', fontSize: 14 },
  clearBtn: { alignItems: 'center', padding: 6 },
  clearTxt: { fontSize: 12, color: '#8a8272', textDecorationLine: 'underline' },
});
