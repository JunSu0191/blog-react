import { describe, expect, it } from "vitest";
import {
  hasResetToken,
  isResetTokenExpired,
} from "@/features/auth/utils/resetPassword";

describe("reset password token guards", () => {
  it("resetToken이 없으면 비밀번호 변경 불가로 판단한다", () => {
    expect(hasResetToken(undefined)).toBe(false);
    expect(hasResetToken(null)).toBe(false);
    expect(hasResetToken("")).toBe(false);
    expect(hasResetToken("   ")).toBe(false);
  });

  it("만료 시각이 현재 이전이면 만료로 판단한다", () => {
    const now = new Date("2026-01-01T10:00:00.000Z").getTime();
    expect(isResetTokenExpired("2026-01-01T09:59:59.000Z", now)).toBe(true);
    expect(isResetTokenExpired("2026-01-01T10:00:01.000Z", now)).toBe(false);
  });
});
