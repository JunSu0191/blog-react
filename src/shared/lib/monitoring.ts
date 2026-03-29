import * as Sentry from "@sentry/react";

type MonitoringContext = {
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const SENTRY_ENVIRONMENT =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim() ||
  import.meta.env.MODE;
const SENTRY_RELEASE =
  (import.meta.env.VITE_SENTRY_RELEASE as string | undefined)?.trim() || undefined;
const SENTRY_TRACES_SAMPLE_RATE_RAW = (
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined
)?.trim();

let isInitialized = false;

function toSampleRate(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;

  const record = error as Record<string, unknown>;
  const status = record.status;
  if (typeof status === "number" && Number.isFinite(status)) return status;
  if (typeof status === "string") {
    const parsed = Number(status);
    if (Number.isFinite(parsed)) return parsed;
  }

  const response = record.response;
  if (response && typeof response === "object") {
    const nestedStatus = (response as Record<string, unknown>).status;
    if (typeof nestedStatus === "number" && Number.isFinite(nestedStatus)) {
      return nestedStatus;
    }
    if (typeof nestedStatus === "string") {
      const parsed = Number(nestedStatus);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function shouldIgnoreError(error: unknown) {
  const status = getErrorStatus(error);
  return status === 401 || status === 403 || status === 404;
}

export const isMonitoringEnabled = Boolean(SENTRY_DSN);

export function initMonitoring() {
  if (isInitialized || !isMonitoringEnabled) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    tracesSampleRate: toSampleRate(SENTRY_TRACES_SAMPLE_RATE_RAW),
    beforeSend(event, hint) {
      if (shouldIgnoreError(hint.originalException)) {
        return null;
      }
      return event;
    },
  });

  isInitialized = true;
}

export function captureException(error: unknown, context: MonitoringContext = {}) {
  if (!isMonitoringEnabled || shouldIgnoreError(error)) return;

  Sentry.withScope((scope) => {
    Object.entries(context.tags ?? {}).forEach(([key, value]) => {
      if (value === null || typeof value === "undefined") return;
      scope.setTag(key, String(value));
    });

    Object.entries(context.extra ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    Sentry.captureException(error);
  });
}
