import { test, expect } from "@playwright/test";

test.describe("Auth recovery flows", () => {
  test("로그인 폼 검증 메시지", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByText("아이디를 입력해주세요")).toBeVisible();
  });

  test("회원가입 플로우", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
  });

  test("아이디 찾기 플로우", async ({ page }) => {
    await page.goto("/find-id");
    await expect(page.getByRole("heading", { name: "아이디 찾기" })).toBeVisible();
  });

  test("비밀번호 재설정 플로우", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByRole("heading", { name: "비밀번호 재설정" }),
    ).toBeVisible();
  });
});
