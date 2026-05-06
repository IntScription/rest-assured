import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A custom hook that returns a memoized callback which always has access to the latest state/props.
 * This eliminates the need for manually syncing refs and useEffects for callbacks.
 */
export function useLatestCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);

  useLayoutEffect(() => {
    ref.current = callback;
  });

  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}
