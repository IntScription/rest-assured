import * as Sentry from "@sentry/react-native";

/**
 * Inert until EXPO_PUBLIC_SENTRY_DSN is set (locally in .env, or as an EAS
 * secret for builds). No DSN = Sentry.init is never called and this module
 * has zero effect on the app.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const isMonitoringEnabled = Boolean(dsn);

export function initMonitoring() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: __DEV__,
    tracesSampleRate: 0,
  });
}

export { Sentry };
