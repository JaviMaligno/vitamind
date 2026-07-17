import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True after hydration, false during SSR and the hydration render.
 *
 * Hydration guard for components that derive output from `new Date()` or
 * localStorage (which differ between server and client → React #418). Prefer
 * this over the `useState(false)` + `useEffect(setMounted)` pattern: it is the
 * React-sanctioned equivalent and doesn't trip the
 * react-hooks/set-state-in-effect lint rule.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
