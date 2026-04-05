import type { AxiosResponse } from "axios";
import { createApiError, parseApiError } from "@/lib/apiError";
import { apiClient } from "@/lib/api";
import type {
  ApiEnvelope,
  CheckAvailabilityData,
  CheckNicknameRequest,
  CheckUsernameRequest,
  CompleteSocialSignupRequest,
  CompleteSocialSignupResponseData,
  PendingSocialSignupData,
  ConfirmVerificationRequest,
  ConfirmVerificationResponseData,
  FindIdConfirmRequest,
  FindIdConfirmResponseData,
  FindIdRequest,
  RegisterRequest,
  RegisterResponseData,
  ResetPasswordApplyRequest,
  ResetPasswordApplyResponseData,
  ResetPasswordConfirmRequest,
  ResetPasswordConfirmResponseData,
  ResetPasswordRequest,
  SendVerificationRequest,
  SendVerificationResponseData,
} from "../types/auth.api";

const AUTH_ENDPOINT = {
  CHECK_USERNAME: "/api/auth/check-username",
  CHECK_NICKNAME: "/api/auth/check-nickname",
  SEND_VERIFICATION: "/api/verifications/send",
  CONFIRM_VERIFICATION: "/api/verifications/confirm",
  REGISTER: "/api/auth/register",
  OAUTH_SIGNUP_PENDING: "/api/auth/oauth/signup/pending",
  COMPLETE_SOCIAL_SIGNUP: "/api/auth/oauth/signup/complete",
  FIND_ID_REQUEST: "/api/auth/find-id/request",
  FIND_ID_CONFIRM: "/api/auth/find-id/confirm",
  RESET_PASSWORD_REQUEST: "/api/auth/reset-password/request",
  RESET_PASSWORD_CONFIRM: "/api/auth/reset-password/confirm",
  RESET_PASSWORD_APPLY: "/api/auth/reset-password",
} as const;

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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePendingSocialSignupData(raw: unknown): PendingSocialSignupData {
  const record = toRecord(raw) ?? {};
  return {
    signupToken: toText(record.signupToken) || undefined,
    email: toText(record.email) || undefined,
    name: toText(record.name) || undefined,
    nickname: toText(record.nickname) || undefined,
    username: toText(record.usernameSuggestion) || undefined,
    authProvider: toText(record.provider) || undefined,
  };
}

function extractErrorCode(payload: unknown): string | null {
  const root = toRecord(payload);
  const nested = toRecord(root?.data);

  return (
    toText(root?.errorCode) ||
    toText(root?.code) ||
    toText(nested?.errorCode) ||
    toText(nested?.code)
  );
}

async function unwrapApiData<T>(
  responsePromise: Promise<AxiosResponse<ApiEnvelope<T>>>,
): Promise<T> {
  try {
    const response = await responsePromise;
    const payload = response.data;

    const payloadRecord = toRecord(payload);
    if (!payloadRecord) {
      throw createApiError({
        status: response.status,
        code: null,
        message: "응답 형식이 올바르지 않습니다.",
        retriable: false,
        data: payload,
      });
    }

    const isSuccess = payload.success === true;
    if (!isSuccess) {
      const statusCode = toStatusCode(payload.status) ?? response.status;
      throw createApiError({
        status: statusCode,
        code: extractErrorCode(payload),
        message: toText(payload.message) || "요청 처리 중 오류가 발생했습니다.",
        retriable: statusCode >= 500,
        data: payload.data,
      });
    }

    return payload.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

export function checkUsernameAvailability(request: CheckUsernameRequest) {
  return unwrapApiData<CheckAvailabilityData>(
    apiClient.get(AUTH_ENDPOINT.CHECK_USERNAME, {
      params: {
        username: request.username,
      },
    }),
  );
}

export function checkNicknameAvailability(request: CheckNicknameRequest) {
  return unwrapApiData<CheckAvailabilityData>(
    apiClient.get(AUTH_ENDPOINT.CHECK_NICKNAME, {
      params: {
        nickname: request.nickname,
      },
    }),
  );
}

export function sendVerificationCode(request: SendVerificationRequest) {
  return unwrapApiData<SendVerificationResponseData>(
    apiClient.post(AUTH_ENDPOINT.SEND_VERIFICATION, request),
  );
}

export function confirmVerificationCode(request: ConfirmVerificationRequest) {
  return unwrapApiData<ConfirmVerificationResponseData>(
    apiClient.post(AUTH_ENDPOINT.CONFIRM_VERIFICATION, request),
  );
}

export function registerAccount(request: RegisterRequest) {
  return unwrapApiData<RegisterResponseData>(
    apiClient.post(AUTH_ENDPOINT.REGISTER, request),
  );
}

export async function getPendingSocialSignup(signupToken: string) {
  const data = await unwrapApiData<unknown>(
    apiClient.get(AUTH_ENDPOINT.OAUTH_SIGNUP_PENDING, {
      params: { signupToken },
    }),
  );
  return normalizePendingSocialSignupData(data);
}

export function completeSocialSignup(request: CompleteSocialSignupRequest) {
  return unwrapApiData<CompleteSocialSignupResponseData>(
    apiClient.post(AUTH_ENDPOINT.COMPLETE_SOCIAL_SIGNUP, request),
  );
}

export function requestFindIdVerification(request: FindIdRequest) {
  return unwrapApiData<SendVerificationResponseData>(
    apiClient.post(AUTH_ENDPOINT.FIND_ID_REQUEST, request),
  );
}

export function confirmFindId(request: FindIdConfirmRequest) {
  return unwrapApiData<FindIdConfirmResponseData>(
    apiClient.post(AUTH_ENDPOINT.FIND_ID_CONFIRM, request),
  );
}

export function requestResetPasswordVerification(request: ResetPasswordRequest) {
  return unwrapApiData<SendVerificationResponseData>(
    apiClient.post(AUTH_ENDPOINT.RESET_PASSWORD_REQUEST, request),
  );
}

export function confirmResetPassword(request: ResetPasswordConfirmRequest) {
  return unwrapApiData<ResetPasswordConfirmResponseData>(
    apiClient.post(AUTH_ENDPOINT.RESET_PASSWORD_CONFIRM, request),
  );
}

export function applyResetPassword(request: ResetPasswordApplyRequest) {
  return unwrapApiData<ResetPasswordApplyResponseData>(
    apiClient.post(AUTH_ENDPOINT.RESET_PASSWORD_APPLY, request),
  );
}
