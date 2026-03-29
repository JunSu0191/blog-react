import type {
  VerificationChannel,
  VerificationStepStatus,
} from "./auth.enums";

export const AvailabilityCheckStatus = {
  IDLE: "IDLE",
  CHECKING: "CHECKING",
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
} as const;

export type AvailabilityCheckStatus =
  (typeof AvailabilityCheckStatus)[keyof typeof AvailabilityCheckStatus];

export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export type RegisterFormValues = {
  username: string;
  nickname: string;
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  passwordConfirm: string;
};

export type RegisterFormErrors = Partial<
  Record<keyof RegisterFormValues | "verificationCode" | "submit", string>
>;

export type AvailabilityFieldState = {
  status: AvailabilityCheckStatus;
  message?: string;
  checkedValue?: string;
};

export type OtpFlowFormState = {
  channel: VerificationChannel;
  target: string;
  code: string;
  stepStatus: VerificationStepStatus;
};

export type FindIdFormValues = {
  channel: VerificationChannel;
  target: string;
  code: string;
};

export type ResetPasswordFormValues = {
  channel: VerificationChannel;
  target: string;
  code: string;
  newPassword: string;
  newPasswordConfirm: string;
};

export type ResetPasswordFormErrors = Partial<
  Record<keyof ResetPasswordFormValues | "submit", string>
>;
