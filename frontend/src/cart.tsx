// Cart context for the order-punching catalog. Resets after order placement.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { OrderItemLine, Product } from "@/src/api";

interface CartCtx {
  items: Record<string, { product: Product; quantity: number }>;
  totalQty: number;
  subtotal: number;
  add: (p: Product) => void;
  sub: (p: Product) => void;
  setQty: (sku: string, qty: number) => void;
  clear: () => void;
  toOrderItems: () => OrderItemLine[];
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Record<string, { product: Product; quantity: number }>>({});

  const add = useCallback((p: Product) => {
    setItems((prev) => {
      const cur = prev[p.sku];
      const nextQty = Math.min((cur?.quantity ?? 0) + 1, p.stock_pieces || 0);
      return { ...prev, [p.sku]: { product: p, quantity: nextQty } };
    });
  }, []);

  const sub = useCallback((p: Product) => {
    setItems((prev) => {
      const cur = prev[p.sku];
      if (!cur) return prev;
      const nextQty = Math.max(cur.quantity - 1, 0);
      const next = { ...prev };
      if (nextQty === 0) delete next[p.sku];
      else next[p.sku] = { product: p, quantity: nextQty };
      return next;
    });
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    setItems((prev) => {
      const cur = prev[sku];
      if (!cur) return prev;
      const next = { ...prev };
      if (qty <= 0) delete next[sku];
      else next[sku] = { product: cur.product, quantity: Math.min(qty, cur.product.stock_pieces || 0) };
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const totalQty = useMemo(() => Object.values(items).reduce((a, b) => a + b.quantity, 0), [items]);
  const subtotal = useMemo(
    () => Object.values(items).reduce((a, b) => a + b.quantity * (b.product.b2b_price || 0), 0),
    [items],
  );

  const toOrderItems = useCallback(
    (): OrderItemLine[] =>
      Object.values(items).map((e) => ({
        sku: e.product.sku,
        name: e.product.name,
        size_label: e.product.size_label,
        quantity: e.quantity,
        unit_price: e.product.b2b_price || 0,
        pieces_per_carton: e.product.pieces_per_carton,
      })),
    [items],
  );

  const value = useMemo<CartCtx>(
    () => ({ items, totalQty, subtotal, add, sub, setQty, clear, toOrderItems }),
    [items, totalQty, subtotal, add, sub, setQty, clear, toOrderItems],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart outside CartProvider");
  return v;
}
