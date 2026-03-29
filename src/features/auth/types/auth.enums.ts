export const VerificationPurpose = {
  SIGNUP: "SIGNUP",
  FIND_ID: "FIND_ID",
  RESET_PASSWORD: "RESET_PASSWORD",
} as const;

export type VerificationPurpose =
  (typeof VerificationPurpose)[keyof typeof VerificationPurpose];

export const VerificationChannel = {
  SMS: "SMS",
  EMAIL: "EMAIL",
} as const;

export type VerificationChannel =
  (typeof VerificationChannel)[keyof typeof VerificationChannel];

export const VerificationStepStatus = {
  IDLE: "IDLE",
  CODE_SENT: "CODE_SENT",
  VERIFIED: "VERIFIED",
  COMPLETED: "COMPLETED",
} as const;

export type VerificationStepStatus =
  (typeof VerificationStepStatus)[keyof typeof VerificationStepStatus];

export const AuthErrorCode = {
  VERIFICATION_EXPIRED: "verification_expired",
  VERIFICATION_CODE_EXPIRED: "verification_code_expired",
  VERIFICATION_ATTEMPTS_EXCEEDED: "verification_attempts_exceeded",
  VERIFICATION_INVALID_CODE: "verification_invalid_code",
  VERIFICATION_NOT_FOUND: "verification_not_found",
  DUPLICATE_USERNAME: "duplicate_username",
  DUPLICATE_NICKNAME: "duplicate_nickname",
  RESET_TOKEN_EXPIRED: "reset_token_expired",
  RESET_TOKEN_INVALID: "reset_token_invalid",
  NETWORK_ERROR: "network_error",
  SERVER_ERROR: "server_error",
  GENERIC: "generic",
  UNKNOWN: "unknown",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export const VERIFICATION_EXPIRED_ERROR_CODES = [
  AuthErrorCode.VERIFICATION_EXPIRED,
  AuthErrorCode.VERIFICATION_CODE_EXPIRED,
  AuthErrorCode.RESET_TOKEN_EXPIRED,
] as const;

export const VERIFICATION_ATTEMPT_EXCEEDED_ERROR_CODES = [
  AuthErrorCode.VERIFICATION_ATTEMPTS_EXCEEDED,
] as const;
