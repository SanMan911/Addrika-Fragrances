'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const PriceVisibilityContext = createContext({
  b2cVisible: true,
  b2bVisible: true,
  loaded: false,
});

export function PriceVisibilityProvider({ children }) {
  const [state, setState] = useState({ b2cVisible: true, b2bVisible: true, loaded: false });

  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/api/products/price-visibility`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d) {
          setState({
            b2cVisible: d.b2c !== false,
            b2bVisible: d.b2b !== false,
            loaded: true,
          });
        }
      })
      .catch(() => {
        if (mounted) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PriceVisibilityContext.Provider value={state}>
      {children}
    </PriceVisibilityContext.Provider>
  );
}

export function usePriceVisibility() {
  return useContext(PriceVisibilityContext);
}

/** Effective visibility for a D2C product: global switch AND product override. */
export function isPriceVisible(globalVisible, product) {
  return globalVisible && !(product && product.hide_price);
}
