import axios from "axios";

export type StandardApiError = {
  status: number | null;
  code: string | null;
  message: string;
  retriable: boolean;
  data?: unknown;
};

type ErrorFactoryInput = {
  status?: number | null;
  code?: string | null;
  message?: string;
  retriable?: boolean;
  data?: unknown;
};

const DEFAULT_ERROR_MESSAGE = "잠시 후 다시 시도해 주세요.";

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStatusCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function inferRetriable(status: number | null, axiosCode?: string | null) {
  if (status === null) return true;
  if (status >= 500) return true;
  if (axiosCode === "ECONNABORTED") return true;
  if (axiosCode === "ERR_NETWORK") return true;
  return false;
}

function extractServerErrorFields(payload: unknown): {
  code: string | null;
  message: string | null;
} {
  const root = toRecord(payload);
  const data = toRecord(root?.data);

  const code =
    toText(root?.errorCode) ||
    toText(root?.code) ||
    toText(data?.errorCode) ||
    toText(data?.code);

  const message =
    toText(root?.message) ||
    toText(data?.message) ||
    null;

  return { code, message };
}

export function createApiError({
  status = null,
  code = null,
  message = DEFAULT_ERROR_MESSAGE,
  retriable = false,
  data,
}: ErrorFactoryInput): StandardApiError {
  return {
    status,
    code,
    message,
    retriable,
    data,
  };
}

export function isStandardApiError(error: unknown): error is StandardApiError {
  const record = toRecord(error);
  if (!record) return false;
  return (
    "status" in record &&
    "message" in record &&
    typeof record.message === "string" &&
    "retriable" in record &&
    typeof record.retriable === "boolean"
  );
}

export function parseApiError(error: unknown): StandardApiError {
  if (isStandardApiError(error)) return error;

  if (axios.isAxiosError(error)) {
    const responseStatus = toStatusCode(error.response?.status);
    const payload = error.response?.data;
    const { code, message } = extractServerErrorFields(payload);
    const fallbackCode =
      responseStatus === null
        ? "network_error"
        : responseStatus >= 500
          ? "server_error"
          : null;

    return createApiError({
      status: responseStatus,
      code: code || fallbackCode,
      message: message || toText(error.message) || DEFAULT_ERROR_MESSAGE,
      retriable: inferRetriable(responseStatus, toText(error.code)),
      data: payload,
    });
  }

  if (error instanceof Error) {
    return createApiError({
      status: null,
      code: null,
      message: toText(error.message) || DEFAULT_ERROR_MESSAGE,
      retriable: false,
    });
  }

  return createApiError({
    status: null,
    code: null,
    message: DEFAULT_ERROR_MESSAGE,
    retriable: false,
  });
}
