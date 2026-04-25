import { useCallback, useState } from "react";
import {
  fetchAppleHealthSnapshot,
  requestAppleHealthPermissions,
  syncAppleHealthToSupabase,
  type AppleHealthSnapshot,
} from "@/src/features/coach/health/apple-health";

export function useAppleHealthSync() {
  const [loading, setLoading] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<AppleHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await requestAppleHealthPermissions();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple Health authorization failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const previewSnapshot = useCallback(async (days = 7) => {
    try {
      setLoading(true);
      setError(null);
      await requestAppleHealthPermissions();
      const snapshot = await fetchAppleHealthSnapshot(days);
      setLastSnapshot(snapshot);
      return snapshot;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to read Apple Health data.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async (userId: string, days = 7) => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await syncAppleHealthToSupabase(userId, days);
      setLastSnapshot(snapshot);
      return snapshot;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to sync Apple Health data.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    lastSnapshot,
    requestPermissions,
    previewSnapshot,
    syncNow,
  };
}
