import { describe, expect, it } from "vitest";
import {
  AvailabilityCheckStatus,
  type AvailabilityFieldState,
} from "@/features/auth/types/auth.form";
import { resetAvailabilityIfValueChanged } from "@/features/auth/utils/validators";

describe("resetAvailabilityIfValueChanged", () => {
  const checkedState: AvailabilityFieldState = {
    status: AvailabilityCheckStatus.AVAILABLE,
    checkedValue: "tester",
    message: "사용 가능",
  };

  it("값이 동일하면 기존 중복확인 상태를 유지한다", () => {
    const result = resetAvailabilityIfValueChanged(checkedState, "tester");
    expect(result.status).toBe(AvailabilityCheckStatus.AVAILABLE);
    expect(result.checkedValue).toBe("tester");
  });

  it("값이 변경되면 중복확인 상태를 무효화한다", () => {
    const result = resetAvailabilityIfValueChanged(checkedState, "tester2");
    expect(result.status).toBe(AvailabilityCheckStatus.IDLE);
    expect(result.checkedValue).toBeUndefined();
  });
});
