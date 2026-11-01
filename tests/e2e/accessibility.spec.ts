import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fill } from "./helpers.ts";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [375, 1280]) {
    test(`axe ${colorScheme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 667 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      const scan = () =>
        new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect((await scan()).violations).toEqual([]);
      await fill(page);
      await page.getByLabel("計算モード").selectOption("detailed");
      await page.getByLabel("一時金で受け取る場合の課税も試算する").check();
      await page.getByLabel("既存資産の移換も比較する").check();
      await page.getByLabel("移換する既存資産（円）").fill("12000");
      await page.getByLabel("移換手数料（円）").fill("110");
      await page.getByLabel("移換期間（月）").fill("2");
      await page.getByRole("button", { name: "比較する" }).click();
      await expect(page.locator("#summary")).toBeVisible();
      await expect(page.locator("#payout-result")).toBeVisible();
      await expect(page.locator("#transfer-result")).toBeVisible();
      await page.getByRole("button", { name: "このシナリオを比較に追加" }).click();
      for (const details of await page.locator("#summary details").all())
        await details.locator("summary").click();
      expect((await scan()).violations).toEqual([]);
    });
  }
}
