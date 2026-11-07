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
