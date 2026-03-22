import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/src/lib/supabase";

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

type UseUsernameAvailabilityParams = {
  initialUsername?: string | null;
  userId?: string | null;
  debounceMs?: number;
};

export const normalizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "");

export const validateUsername = (value: string) => {
  if (!value) return "Username is required";
  if (!/^[a-z0-9_]{3,20}$/.test(value)) {
    return "Use 3–20 lowercase letters, numbers, or underscores";
  }
  return null;
};

export function useUsernameAvailability({
  initialUsername,
  userId,
  debounceMs = 350,
}: UseUsernameAvailabilityParams) {
  const initialNormalized = useMemo(
    () => normalizeUsername(initialUsername ?? ""),
    [initialUsername]
  );

  const [value, setValueState] = useState(initialNormalized);
  const [status, setStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>(
    "Pick a unique username for sharing."
  );
  const [isChecking, setIsChecking] = useState(false);

  const requestIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedValue = useMemo(() => normalizeUsername(value), [value]);
  const validationError = useMemo(
    () => validateUsername(normalizedValue),
    [normalizedValue]
  );

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const applyIdleState = useCallback(() => {
    setStatus("idle");
    setStatusMessage("Use 3–20 lowercase letters, numbers, or underscores.");
    setIsChecking(false);
  }, []);

  const checkAvailabilityNow = useCallback(
    async (candidate?: string): Promise<UsernameAvailabilityStatus> => {
      const clean = normalizeUsername(candidate ?? normalizedValue);
      const validation = validateUsername(clean);

      if (!clean) {
        applyIdleState();
        return "idle";
      }

      if (validation) {
        setStatus("invalid");
        setStatusMessage(validation);
        setIsChecking(false);
        return "invalid";
      }

      if (clean === initialNormalized) {
        setStatus("available");
        setStatusMessage(
          clean ? "This is your current username." : "Username unchanged."
        );
        setIsChecking(false);
        return "available";
      }

      const requestId = ++requestIdRef.current;
      setIsChecking(true);
      setStatus("checking");
      setStatusMessage("Checking availability...");

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", clean)
          .maybeSingle();

        if (requestId !== requestIdRef.current) return status;
        if (error && error.code !== "PGRST116") throw error;

        const isTaken = !!data && data.id !== userId;

        setStatus(isTaken ? "taken" : "available");
        setStatusMessage(
          isTaken
            ? "That username is already taken."
            : "Username is available."
        );
        setIsChecking(false);

        return isTaken ? "taken" : "available";
      } catch {
        if (requestId !== requestIdRef.current) return status;

        setStatus("idle");
        setStatusMessage("Could not verify username right now.");
        setIsChecking(false);
        return "idle";
      }
    },
    [applyIdleState, initialNormalized, normalizedValue, status, userId]
  );

  useEffect(() => {
    clearPendingTimeout();

    if (!normalizedValue) {
      applyIdleState();
      return;
    }

    if (validationError) {
      setStatus("invalid");
      setStatusMessage(validationError);
      setIsChecking(false);
      return;
    }

    if (normalizedValue === initialNormalized) {
      setStatus("available");
      setStatusMessage(
        normalizedValue
          ? "This is your current username."
          : "Username unchanged."
      );
      setIsChecking(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      checkAvailabilityNow(normalizedValue);
    }, debounceMs);

    return clearPendingTimeout;
  }, [
    applyIdleState,
    checkAvailabilityNow,
    clearPendingTimeout,
    debounceMs,
    initialNormalized,
    normalizedValue,
    validationError,
  ]);

  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);

  const setValue = useCallback((nextValue: string) => {
    setValueState(normalizeUsername(nextValue));
  }, []);

  const reset = useCallback(
    (nextValue = initialNormalized) => {
      clearPendingTimeout();
      requestIdRef.current += 1;
      setValueState(normalizeUsername(nextValue));
      setIsChecking(false);

      const nextClean = normalizeUsername(nextValue);
      if (!nextClean) {
        applyIdleState();
        return;
      }

      const nextValidation = validateUsername(nextClean);
      if (nextValidation) {
        setStatus("invalid");
        setStatusMessage(nextValidation);
        return;
      }

      setStatus("available");
      setStatusMessage(
        nextClean === initialNormalized
          ? "This is your current username."
          : "Username is available."
      );
    },
    [applyIdleState, clearPendingTimeout, initialNormalized]
  );

  return {
    value,
    setValue,
    normalizedValue,
    validationError,
    status,
    statusMessage,
    isChecking,
    checkAvailabilityNow,
    reset,
  };
}
