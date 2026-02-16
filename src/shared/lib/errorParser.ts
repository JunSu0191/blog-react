import type { ApiError } from "./api";

type ErrorWithResponse = {
  response?: {
    data?: {
      message?: unknown;
    };
  };
};

type ErrorWithData = {
  data?: unknown;
};

function toMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isGenericAxiosMessage(message?: string) {
  if (!message) return false;
  return /^Request failed with status code \d+$/.test(message);
}

function getMessageFromDataContainer(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const direct = toMessage(obj.message);
  if (direct) return direct;

  if (obj.data && typeof obj.data === "object") {
    const nested = toMessage((obj.data as Record<string, unknown>).message);
    if (nested) return nested;
  }
  return undefined;
}

export function parseErrorMessage(
  error: unknown,
  fallback = "요청 처리 중 오류가 발생했습니다.",
): string {
  if (!error) return fallback;

  const apiError = error as ApiError;
  const messageFromApiData = getMessageFromDataContainer(
    (error as ErrorWithData).data,
  );
  if (messageFromApiData) return messageFromApiData;

  const nestedMessage = toMessage(
    (error as ErrorWithResponse).response?.data?.message,
  );
  if (nestedMessage) return nestedMessage;

  const apiMessage = toMessage(apiError.message);
  if (apiMessage && !isGenericAxiosMessage(apiMessage)) return apiMessage;

  if (apiMessage) return apiMessage;

  if (error instanceof Error) {
    const message = toMessage(error.message);
    if (message) return message;
  }

  return fallback;
}
