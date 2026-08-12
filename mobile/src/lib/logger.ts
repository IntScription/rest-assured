import { isMonitoringEnabled, Sentry } from "@/src/lib/monitoring";

/**
 * Small logging seam so error/warning call sites don't hard-depend on
 * Sentry being configured. In dev this just prints; in any environment
 * where a Sentry DSN is set, it also reports there.
 */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  if (__DEV__) {
    console.error(`[${context}]`, error, extra ?? "");
  }

  if (isMonitoringEnabled) {
    Sentry.captureException(error, { tags: { context }, extra });
  }
}

export function logWarn(context: string, message: string, extra?: Record<string, unknown>) {
  if (__DEV__) {
    console.warn(`[${context}]`, message, extra ?? "");
  }

  if (isMonitoringEnabled) {
    Sentry.captureMessage(message, { level: "warning", tags: { context }, extra });
  }
}
