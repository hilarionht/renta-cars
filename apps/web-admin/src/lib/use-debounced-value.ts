'use client';

import { useEffect, useState } from 'react';

// Busquedas que pegan al API mientras se escribe (docs/persistence/10-DECISIONES.md #135).
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
