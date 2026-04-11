import { describe, expect, it } from "vitest";
import { resolveDisplayName } from "../../../src/shared/lib/displayName";

describe("resolveDisplayName", () => {
  it("nickname을 우선 사용한다", () => {
    expect(
      resolveDisplayName({
        nickname: "채팅닉네임",
        name: "실명",
        username: "user01",
      }),
    ).toBe("채팅닉네임");
  });

  it("nickname이 없으면 name을 fallback으로 사용한다", () => {
    expect(
      resolveDisplayName({
        nickname: "",
        name: "실명",
        username: "user01",
      }),
    ).toBe("실명");
  });

  it("생성형 소셜 핸들은 표시명으로 사용하지 않는다", () => {
    expect(
      resolveDisplayName({
        nickname: "google_abcd1234",
        username: "google_abcd1234",
      }),
    ).toBe("google_abcd1234");
  });
});
