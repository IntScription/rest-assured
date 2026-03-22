// src/hooks/useUpdateNotice.ts
import { useEffect, useState } from "react";
import * as Application from "expo-application";
import { getVisibleUpdateNotice, type AppNotice } from "@/src/lib/notices/getUpdateNotice";
import { isVersionLessThan } from "@/src/lib/versioning";

type UpdateState = {
  loading: boolean;
  notice: AppNotice | null;
  shouldShow: boolean;
  mustUpdate: boolean;
  currentVersion: string;
};

export function useUpdateNotice(userId?: string) {
  const [state, setState] = useState<UpdateState>({
    loading: true,
    notice: null,
    shouldShow: false,
    mustUpdate: false,
    currentVersion: Application.nativeApplicationVersion ?? "0.0.0",
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!userId) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const currentVersion = Application.nativeApplicationVersion ?? "0.0.0";
        const notice = await getVisibleUpdateNotice(userId);

        if (!notice) {
          if (!cancelled) {
            setState({
              loading: false,
              notice: null,
              shouldShow: false,
              mustUpdate: false,
              currentVersion,
            });
          }
          return;
        }

        const minVersion = notice.min_app_version ?? null;
        const latestVersion = notice.latest_app_version ?? null;

        const mustUpdate =
          !!minVersion && isVersionLessThan(currentVersion, minVersion);

        const shouldShow =
          mustUpdate ||
          (!!latestVersion && isVersionLessThan(currentVersion, latestVersion));

        if (!cancelled) {
          setState({
            loading: false,
            notice,
            shouldShow,
            mustUpdate,
            currentVersion,
          });
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}
