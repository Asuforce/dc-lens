import { expect, test } from "@playwright/test";
import { fill } from "./helpers.ts";

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

test("privacy, evidence, charts and mobile tables", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const requests: { url: string; data: string; headers: Record<string, string> }[] = [];
  page.on("request", (request) =>
    requests.push({
      url: request.url(),
      data: request.postData() ?? "",
      headers: request.headers(),
    }),
  );
  await page.goto("/");
  await fill(page);
  await page.getByRole("button", { name: "比較する" }).click();
  await page.locator('[name="valuation"]').selectOption("present-value");
  for (const detail of await page.locator("#summary details").all())
    await detail.locator("summary").click();
  await expect(
    page.getByRole("heading", { name: "注意事項" }).locator("+ ul li").first(),
  ).toBeVisible();
  await expect(page.locator("#faq")).toBeVisible();
  await expect(page.getByText("制度データ版:", { exact: false })).toBeVisible();
  await expect(page.getByText("検証日", { exact: false }).first()).toBeVisible();
  const links = await page
    .locator("#summary a")
    .evaluateAll((items) => items.map((item) => (item as HTMLAnchorElement).href));
  expect(
    links.some((link) => {
      const url = new URL(link);
      return (
        url.protocol === "https:" &&
        [
          "nenkin.go.jp",
          "mhlw.go.jp",
          "nta.go.jp",
          "kyoukaikenpo.or.jp",
          "soumu.go.jp",
          "e-gov.go.jp",
        ].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      );
    }),
  ).toBe(true);
  const charts = page.locator('#summary svg[role="img"]');
  await expect(charts).toHaveCount(2);
  const yearlyCount =
    (await page.getByText("年次詳細", { exact: true }).locator("..").locator("table tr").count()) -
    1;
  for (const svg of await charts.all()) {
    expect(await svg.getAttribute("aria-label")).toBeTruthy();
    expect((await svg.locator("xpath=ancestor::section[1]").locator("table tr").count()) - 1).toBe(
      yearlyCount,
    );
  }
  expect(
    await page.evaluate(() => ({
      cookie: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
      query: location.search,
      hash: location.hash,
      overflow: document.documentElement.scrollWidth > innerWidth,
    })),
  ).toEqual({ cookie: "", local: 0, session: 0, query: "", hash: "", overflow: false });
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe(new URL(page.url()).origin);
    for (const value of ["4200000", "20000"]) expect(JSON.stringify(request)).not.toContain(value);
  }
});

test("zero contributions and invalid contribution", async ({ page }) => {
  await page.goto("/");
  await fill(page);
  await page.locator('[name="dcContribution"]').fill("400000");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(page.locator("#errors")).not.toBeEmpty();
  await expect(page.locator("#errors")).toBeFocused();
  await page.locator('[name="dcContribution"]').fill("0");
  await page.locator('[name="idecoContribution"]').fill("0");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(page.locator("#summary")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "損益分岐年齢（名目）" }).locator("+ p"),
  ).toHaveText("なし");
  await expect(page.getByRole("heading", { name: "現在の年間手取り差" }).locator("+ p")).toHaveText(
    "0円",
  );
  for (const label of [
    "退職時資産差（税引前評価額）",
    "老齢厚生年金 年額差",
    "生涯累積差（名目）",
    "生涯累積差（現在価値）",
  ])
    await expect(page.getByRole("heading", { name: label }).locator("+ p")).toHaveText("0円");
});

test("keyboard navigation submits and opens details", async ({ page }) => {
  await page.goto("/");
  const values: Record<string, string> = {
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
  };
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const name = await focused.getAttribute("name");
    if (name && values[name]) await page.keyboard.type(values[name]);
    if (name === "prefecture") await page.keyboard.press("End");
    if ((await focused.textContent()) === "比較する") {
      await page.keyboard.press("Enter");
      break;
    }
  }
  await expect(page.locator("#summary")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    if ((await page.locator(":focus").textContent()) === "現在の内訳") {
      await page.keyboard.press("Enter");
      break;
    }
  }
  await expect(page.getByText("現在の内訳", { exact: true }).locator("..")).toHaveAttribute(
    "open",
    "",
  );
  await page.keyboard.press("Space");
  await expect(page.getByText("現在の内訳", { exact: true }).locator("..")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByText("現在の内訳", { exact: true })).toBeFocused();
});
