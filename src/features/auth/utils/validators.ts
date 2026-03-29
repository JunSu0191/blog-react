import type {
  AvailabilityFieldState,
  ValidationResult,
} from "../types/auth.form";
import { AvailabilityCheckStatus } from "../types/auth.form";

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateRequiredText(value: string, message: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, message };
  }
  return { valid: true };
}

export function validateEmailFormat(value: string): ValidationResult {
  if (!value.trim()) return { valid: true };
  if (!EMAIL_REGEX.test(value.trim())) {
    return { valid: false, message: "이메일 형식이 올바르지 않습니다." };
  }
  return { valid: true };
}

export function validatePasswordPolicy(value: string): ValidationResult {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
    };
  }
  return { valid: true };
}

export function validatePasswordConfirm(
  password: string,
  passwordConfirm: string,
): ValidationResult {
  if (password !== passwordConfirm) {
    return { valid: false, message: "비밀번호가 일치하지 않습니다." };
  }

  return { valid: true };
}

export function toIdleAvailabilityState(): AvailabilityFieldState {
  return {
    status: AvailabilityCheckStatus.IDLE,
    message: undefined,
    checkedValue: undefined,
  };
}

export function resetAvailabilityIfValueChanged(
  state: AvailabilityFieldState,
  nextValue: string,
) {
  const normalized = nextValue.trim();
  if (state.checkedValue === normalized) {
    return state;
  }
  return toIdleAvailabilityState();
}

export function hasAvailabilityCheckPassed(
  state: AvailabilityFieldState,
  currentValue: string,
) {
  return (
    state.status === AvailabilityCheckStatus.AVAILABLE &&
    state.checkedValue === currentValue.trim()
  );
}
