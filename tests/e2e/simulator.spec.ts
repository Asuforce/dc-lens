import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function fill(page: Page) {
  for (const [name, value] of Object.entries({
    age: "35",
    retirementAge: "60",
    pensionStartAge: "65",
    pensionEndAge: "90",
    annualIncome: "4200000",
    monthlySalary: "300000",
    bonus: "600000",
    raiseRate: "1",
    dcContribution: "20000",
    idecoContribution: "20000",
    dcCost: "0.3",
    idecoCost: "0.3",
    fixedFee: "0",
    initialBalance: "0",
    grossReturn: "3",
    inflation: "1",
    discount: "2",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="prefecture"]').selectOption("tokyo");
}
test("submits, updates results, and exposes sources without sending inputs", async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    requests.push(`${r.url()} ${r.postData() ?? ""}`);
    expect(r.url().startsWith(baseURL ?? "")).toBe(true);
  });
  await page.goto("/");
  await fill(page);
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(page.locator("#summary")).toBeVisible();
  await expect(page.locator("svg")).toHaveCount(2);
  const before = await page.locator("#summary").textContent();
  await page.locator('[name="dcContribution"]').fill("10000");
  await page.getByRole("button", { name: "比較する" }).click();
  expect(await page.locator("#summary").textContent()).not.toBe(before);
  await page.locator('[name="valuation"]').selectOption("present-value");
  await expect(page.getByRole("heading", { name: "損益分岐年齢（現在価値）" })).toBeVisible();
  await page.getByText("計算根拠", { exact: true }).click();
  await expect(page.getByText("制度データ版:", { exact: false })).toBeVisible();
  await expect(page.locator("#summary a").first()).toBeVisible();
  expect(requests.join(" ")).not.toContain("4200000");
});
test("invalid income clears result", async ({ page }) => {
  await page.goto("/");
  await fill(page);
  await page.locator('[name="annualIncome"]').fill("1");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(page.locator("#errors")).toContainText("年収");
  await expect(page.locator("#summary")).toHaveCount(0);
});
test("enter submits and mobile fits", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await fill(page);
  await page.locator('[name="discount"]').press("Enter");
  await expect(page.locator("#summary")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
