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
      await page.getByLabel("一時金で受け取る場合の課税も試算する").check();
      await page.getByRole("button", { name: "比較する" }).click();
      await expect(page.locator("#summary")).toBeVisible();
      await expect(page.locator("#payout-result")).toBeVisible();
      await page.getByRole("button", { name: "このシナリオを比較に追加" }).click();
      for (const details of await page.locator("#summary details").all())
        await details.locator("summary").click();
      expect((await scan()).violations).toEqual([]);
    });
  }
}
