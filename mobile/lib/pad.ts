/**
 * B2B order pad, persisted in AsyncStorage.
 *
 * Wholesale quantities are counted in BOXES and may be halves, so the unit
 * here is a float — never assume integers. Prices shown are indicative:
 * the authoritative total always comes from the server's
 * /api/app/v2/orders/calculate, because tier pricing, carton math, cash
 * discounts and GST must not be computed on a device we don't control.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type PadLine = {
  sku: string;
  name: string;
  sizeLabel: string | null;
  boxes: number;
  indicativePricePerBox: number;
  imageUrl?: string | null;
};

const KEY = 'aarohmm.orderpad.v1';

export type PadContextValue = {
  lines: PadLine[];
  ready: boolean;
  setBoxes: (line: Omit<PadLine, 'boxes'>, boxes: number) => Promise<void>;
  remove: (sku: string) => Promise<void>;
  clear: () => Promise<void>;
  boxesFor: (sku: string) => number;
  indicativeSubtotal: number;
  lineCount: number;
};

export const PadContext = createContext<PadContextValue>({
  lines: [],
  ready: false,
  setBoxes: async () => {},
  remove: async () => {},
  clear: async () => {},
  boxesFor: () => 0,
  indicativeSubtotal: 0,
  lineCount: 0,
});

export function usePad(): PadContextValue {
  return useContext(PadContext);
}

export function usePadState(): PadContextValue {
  const [lines, setLines] = useState<PadLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setLines(raw ? (JSON.parse(raw) as PadLine[]) : []))
      .catch(() => setLines([]))
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback(async (next: PadLine[]) => {
    setLines(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const setBoxes = useCallback(
    async (line: Omit<PadLine, 'boxes'>, boxes: number) => {
      const rounded = Math.max(0, Math.round(boxes * 2) / 2); // halves allowed
      const without = lines.filter((l) => l.sku !== line.sku);
      await persist(rounded === 0 ? without : [...without, { ...line, boxes: rounded }]);
    },
    [lines, persist]
  );

  const remove = useCallback(
    async (sku: string) => persist(lines.filter((l) => l.sku !== sku)),
    [lines, persist]
  );

  const clear = useCallback(async () => persist([]), [persist]);

  const boxesFor = useCallback(
    (sku: string) => lines.find((l) => l.sku === sku)?.boxes ?? 0,
    [lines]
  );

  const indicativeSubtotal = lines.reduce(
    (sum, l) => sum + l.indicativePricePerBox * l.boxes,
    0
  );

  return {
    lines,
    ready,
    setBoxes,
    remove,
    clear,
    boxesFor,
    indicativeSubtotal,
    lineCount: lines.length,
  };
}
