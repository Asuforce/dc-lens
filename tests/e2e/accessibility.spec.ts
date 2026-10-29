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
      await page.getByRole("button", { name: "比較する" }).click();
      await expect(page.locator("#summary")).toBeVisible();
      for (const details of await page.locator("#summary details").all())
        await details.locator("summary").click();
      expect((await scan()).violations).toEqual([]);
    });
  }
}
