import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, createContext, useContext } from 'react';

/**
 * Client-side cart persisted in AsyncStorage.
 *
 * Checkout doesn't happen in-app — the "Complete Order" button opens the
 * web checkout with the cart handed over via a `?cart=` query param.
 * That keeps GST/Razorpay/order-confirmation flows on the domain where
 * they're already battle-tested.
 */
export type CartLine = {
  productId: string;
  name: string;
  size: string;
  priceInr: number;
  quantity: number;
  image?: string;
};

const KEY = 'addrika.cart.v1';

async function load(): Promise<CartLine[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

async function save(lines: CartLine[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(lines));
}

export type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  add: (line: CartLine) => Promise<void>;
  remove: (productId: string, size: string) => Promise<void>;
  setQty: (productId: string, size: string, qty: number) => Promise<void>;
  clear: () => Promise<void>;
  subtotal: number;
  itemCount: number;
};

export const CartContext = createContext<CartContextValue>({
  lines: [],
  ready: false,
  add: async () => {},
  remove: async () => {},
  setQty: async () => {},
  clear: async () => {},
  subtotal: 0,
  itemCount: 0,
});

export function useCart(): CartContextValue {
  return useContext(CartContext);
}

export function useCartState(): CartContextValue {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    load().then((l) => {
      setLines(l);
      setReady(true);
    });
  }, []);

  const persist = useCallback(async (next: CartLine[]) => {
    setLines(next);
    await save(next);
  }, []);

  const add = useCallback(
    async (line: CartLine) => {
      const existing = lines.findIndex(
        (l) => l.productId === line.productId && l.size === line.size
      );
      let next: CartLine[];
      if (existing >= 0) {
        next = [...lines];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + line.quantity };
      } else {
        next = [...lines, line];
      }
      await persist(next);
    },
    [lines, persist]
  );

  const remove = useCallback(
    async (productId: string, size: string) => {
      await persist(lines.filter((l) => !(l.productId === productId && l.size === size)));
    },
    [lines, persist]
  );

  const setQty = useCallback(
    async (productId: string, size: string, qty: number) => {
      if (qty <= 0) return remove(productId, size);
      await persist(
        lines.map((l) =>
          l.productId === productId && l.size === size ? { ...l, quantity: qty } : l
        )
      );
    },
    [lines, persist, remove]
  );

  const clear = useCallback(async () => {
    await persist([]);
  }, [persist]);

  const subtotal = lines.reduce((s, l) => s + l.priceInr * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return { lines, ready, add, remove, setQty, clear, subtotal, itemCount };
}

/**
 * Encode the cart into the `?cart=` param the web checkout expects.
 *
 * Format: JSON array of `{productId, size, quantity, quantity_boxes}`,
 * URL-encoded. Web B2C `/cart` reads `productId + size + quantity`; the
 * web B2B `/retailer/b2b` page reads `productId + quantity_boxes` (each
 * "box" is a wholesale unit and can be a half — hence the number). We
 * carry BOTH so the same param drives either landing page without
 * mobile needing to know which flow it is.
 */
export function encodeCartForWeb(lines: CartLine[]): string {
  const payload = lines.map((l) => ({
    productId: l.productId,
    size: l.size,
    quantity: l.quantity,
    quantity_boxes: l.quantity,
  }));
  return encodeURIComponent(JSON.stringify(payload));
}
