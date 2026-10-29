import { expect, test } from "@playwright/test";

test("page loads, shows build info, and makes no external requests", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    if (!req.url().startsWith(baseURL ?? "")) external.push(req.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DC Lens" })).toBeVisible();
  await expect(page.locator("#build-version")).not.toBeEmpty();
  await expect(page.locator("#build-sha")).not.toBeEmpty();
  expect(external).toEqual([]);
});
