import {
  AuthErrorCode,
  VERIFICATION_ATTEMPT_EXCEEDED_ERROR_CODES,
  VERIFICATION_EXPIRED_ERROR_CODES,
  type AuthErrorCode as AuthErrorCodeType,
} from "../types/auth.enums";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCodeType, string> = {
  [AuthErrorCode.VERIFICATION_EXPIRED]: "인증번호가 만료되었습니다. 재전송해 주세요.",
  [AuthErrorCode.VERIFICATION_CODE_EXPIRED]: "인증번호가 만료되었습니다. 재전송해 주세요.",
  [AuthErrorCode.VERIFICATION_ATTEMPTS_EXCEEDED]: "시도 횟수를 초과했습니다.",
  [AuthErrorCode.VERIFICATION_INVALID_CODE]: "인증번호가 올바르지 않습니다.",
  [AuthErrorCode.VERIFICATION_NOT_FOUND]: "인증 세션을 찾을 수 없습니다. 다시 시도해 주세요.",
  [AuthErrorCode.DUPLICATE_USERNAME]: "이미 사용 중인 아이디입니다.",
  [AuthErrorCode.DUPLICATE_NICKNAME]: "이미 사용 중인 닉네임입니다.",
  [AuthErrorCode.RESET_TOKEN_EXPIRED]: "재설정 토큰이 만료되었습니다. 다시 인증해 주세요.",
  [AuthErrorCode.RESET_TOKEN_INVALID]: "유효하지 않은 재설정 토큰입니다.",
  [AuthErrorCode.NETWORK_ERROR]: "네트워크 연결을 확인한 후 다시 시도해 주세요.",
  [AuthErrorCode.SERVER_ERROR]: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  [AuthErrorCode.GENERIC]: "잠시 후 다시 시도해 주세요.",
  [AuthErrorCode.UNKNOWN]: "잠시 후 다시 시도해 주세요.",
};

function normalizeCode(code?: string | null) {
  if (!code) return null;
  const trimmed = code.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function includesCode<T extends readonly string[]>(codes: T, code: string) {
  return (codes as readonly string[]).includes(code);
}

export function resolveAuthErrorMessage(code?: string | null, fallback?: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return fallback || AUTH_ERROR_MESSAGES[AuthErrorCode.GENERIC];

  if (includesCode(VERIFICATION_EXPIRED_ERROR_CODES, normalized)) {
    return AUTH_ERROR_MESSAGES[AuthErrorCode.VERIFICATION_EXPIRED];
  }

  if (includesCode(VERIFICATION_ATTEMPT_EXCEEDED_ERROR_CODES, normalized)) {
    return AUTH_ERROR_MESSAGES[AuthErrorCode.VERIFICATION_ATTEMPTS_EXCEEDED];
  }

  const exact = AUTH_ERROR_MESSAGES[normalized as AuthErrorCodeType];
  if (exact) return exact;

  return fallback || AUTH_ERROR_MESSAGES[AuthErrorCode.GENERIC];
}
