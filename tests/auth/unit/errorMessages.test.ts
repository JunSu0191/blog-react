import { describe, expect, it } from "vitest";
import { resolveAuthErrorMessage } from "@/features/auth/constants/errorMessages";
import { AuthErrorCode } from "@/features/auth/types/auth.enums";

describe("resolveAuthErrorMessage", () => {
  it("verification_expired 계열 코드를 만료 안내 메시지로 변환한다", () => {
    const result = resolveAuthErrorMessage(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
    expect(result).toContain("만료");
  });

  it("verification_attempts_exceeded 계열 코드를 시도초과 메시지로 변환한다", () => {
    const result = resolveAuthErrorMessage(
      AuthErrorCode.VERIFICATION_ATTEMPTS_EXCEEDED,
    );
    expect(result).toContain("시도 횟수");
  });

  it("알 수 없는 코드는 기본 메시지를 반환한다", () => {
    const result = resolveAuthErrorMessage("unexpected_code");
    expect(result).toContain("잠시 후");
  });
});
