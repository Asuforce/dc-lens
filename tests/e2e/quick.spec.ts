import { expect, test } from "@playwright/test";

test("three inputs calculate and update without sending input data", async ({ page }) => {
  await page.goto("/");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await expect(page.locator("input:visible")).toHaveCount(3);
  await page.getByRole("button", { name: "概算する" }).click();
  await expect(page.locator("#errors")).toContainText("3項目");
  await page.locator('[name="income"]').fill("5376000");
  await page.locator('[name="contribution"]').fill("12000");
  await page.locator('[name="balance"]').fill("0");
  await page.getByRole("button", { name: "概算する" }).click();
  await expect(page.locator("#errors")).toBeEmpty();
  const table = page.locator("#output table");
  await expect(table).toContainText("30年後");
  const before = await table.textContent();
  await page.locator('[name="balance"]').fill("750000");
  await expect(table).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "詳細入力に切り替える" }).click();
  await expect(page.locator('[name="age"]')).toBeVisible();
  expect(requests).toEqual([]);
});

test("quick editing keeps focus and mobile results stay inside the page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(page.locator("#errors")).toBeEmpty();
  await expect(page.getByRole("heading", { name: "シナリオ比較", exact: true })).toBeHidden();
  const income = page.locator('[name="income"]');
  await income.fill("4832000");
  await page.locator('[name="contribution"]').fill("14000");
  await page.locator('[name="balance"]').fill("86000");
  await page.getByRole("button", { name: "概算する" }).click();
  await expect(page.locator("#result-status")).toContainText("更新しました");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await income.fill("");
  await expect(page.locator("#result-status")).toBeEmpty();
  await expect(page.locator("#result-link")).toBeHidden();
  await expect(income).toBeFocused();
  await income.pressSequentially("4832000");
  await expect(income).toBeFocused();
  await expect(page.locator("#errors")).toBeEmpty();
  await expect(page.locator("#output table")).toBeVisible();
});
