import type { ApiError } from "./api";

type ErrorWithResponse = {
  response?: {
    data?: {
      message?: unknown;
    };
  };
};

function toMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseErrorMessage(
  error: unknown,
  fallback = "요청 처리 중 오류가 발생했습니다.",
): string {
  if (!error) return fallback;

  const apiError = error as ApiError;
  const apiMessage = toMessage(apiError.message);
  if (apiMessage) return apiMessage;

  const nestedMessage = toMessage(
    (error as ErrorWithResponse).response?.data?.message,
  );
  if (nestedMessage) return nestedMessage;

  if (error instanceof Error) {
    const message = toMessage(error.message);
    if (message) return message;
  }

  return fallback;
}
