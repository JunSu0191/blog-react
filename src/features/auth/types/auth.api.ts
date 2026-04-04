import type {
  VerificationChannel,
  VerificationPurpose,
} from "./auth.enums";

export type ApiEnvelope<T> = {
  status: string | number;
  success: boolean;
  message?: string;
  data: T;
};

export type CheckAvailabilityData = {
  available: boolean;
};

export type CheckUsernameRequest = {
  username: string;
};

export type CheckNicknameRequest = {
  nickname: string;
};

export type SendVerificationRequest = {
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  target: string;
};

export type SendVerificationResponseData = {
  verificationId: number;
  expiresAt: string;
  resendCount: number;
  cooldownSeconds: number;
  debugCode?: string;
};

export type ConfirmVerificationRequest = {
  verificationId: number;
  code: string;
};

export type ConfirmVerificationResponseData = {
  verificationId: number;
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  target: string;
  verifiedAt: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  name: string;
  nickname: string;
  email?: string;
  phoneNumber?: string;
  verificationId?: number;
};

export type RegisterResponseData = {
  username?: string;
  createdAt?: string;
};

export type FindIdRequest = {
  channel: VerificationChannel;
  target: string;
};

export type FindIdConfirmRequest = {
  verificationId: number;
  code: string;
};

export type FindIdConfirmResponseData = {
  maskedUsername: string;
};

export type ResetPasswordRequest = {
  channel: VerificationChannel;
  target: string;
};

export type ResetPasswordConfirmRequest = {
  verificationId: number;
  code: string;
};

export type ResetPasswordConfirmResponseData = {
  resetToken: string;
  expiresAt: string;
};

export type ResetPasswordApplyRequest = {
  resetToken: string;
  newPassword: string;
};

export type ResetPasswordApplyResponseData = {
  changedAt?: string;
};
