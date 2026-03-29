import { describe, expect, it } from "vitest";
import { calculateRemainingSeconds } from "@/features/auth/hooks/useCooldownTimer";

describe("calculateRemainingSeconds", () => {
  it("남은 시간이 양수일 때 초 단위로 올림 계산한다", () => {
    const result = calculateRemainingSeconds(10_001, 1_000);
    expect(result).toBe(10);
  });

  it("목표 시간이 현재보다 작거나 같으면 0을 반환한다", () => {
    expect(calculateRemainingSeconds(5_000, 5_000)).toBe(0);
    expect(calculateRemainingSeconds(4_999, 5_000)).toBe(0);
  });
});
