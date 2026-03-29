import { expect, test } from "@playwright/test";

test.describe("Core navigation", () => {
  test("글 목록 페이지 기본 UI", async ({ page }) => {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { name: "모든 글 탐색" })).toBeVisible();
    await expect(page.getByRole("link", { name: "글 작성" })).toBeVisible();
  });

  test("유효하지 않은 게시글 주소 처리", async ({ page }) => {
    await page.goto("/posts/invalid");
    await expect(page.getByText("유효하지 않은 접근입니다.")).toBeVisible();
  });

  test("보호된 글 작성 화면 접근 시 로그인 안내", async ({ page }) => {
    await page.goto("/posts/create");
    await expect(page.getByText("로그인이 필요합니다")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인 페이지 이동" })).toBeVisible();
  });
});
