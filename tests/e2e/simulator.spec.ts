import { expect, test } from "@playwright/test";
import { fill } from "./helpers.ts";

test("switches detailed mode while keeping inputs local", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.url()} ${request.postData() ?? ""}`));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await fill(page);
  await page.getByRole("button", { name: "比較する" }).click();
  const simple = await page.locator("#summary .cards").textContent();
  await page.getByLabel("計算モード").selectOption("detailed");
  await page.getByLabel("昇給月").selectOption("7");
  await page.getByRole("button", { name: "比較する" }).click();
  await page.getByText("年次詳細", { exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "標準報酬月額 厚年 / 健保 (DC → iDeCo)" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("計算モード").selectOption("simple");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(
    page.getByRole("columnheader", { name: "標準報酬月額 厚年 / 健保 (DC → iDeCo)" }),
  ).toHaveCount(0);
  expect(await page.locator("#summary .cards").textContent()).toBe(simple);
  expect(
    requests.every(
      (url) =>
        new URL(url.split(" ")[0] ?? "").origin === new URL(page.url()).origin &&
        !url.includes("4200000"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test("shows optional payout tax without sending or storing inputs", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  await fill(page);
  const toggle = page.getByLabel("一時金で受け取る場合の課税も試算する");
  await toggle.check();
  await page.getByLabel("すでに拠出した年数（勤続年数に加算）").fill("3");
  await page.getByRole("button", { name: "比較する" }).click();
  const payout = page.locator("#payout-result");
  await expect(payout.getByRole("heading", { name: "一時金受取時の課税（試算）" })).toBeVisible();
  await expect(payout.getByText(/短期退職手当等、特定役員退職手当等.*対象外/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await toggle.uncheck();
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(payout).toHaveCount(0);
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test("compares transfer separately without sending or storing inputs", async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL ?? "")) external.push(request.url());
  });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await fill(page);
  await page.getByLabel("既存資産の移換も比較する").check();
  await page.getByLabel("移換する既存資産（円）").fill("12000");
  await page.getByLabel("移換手数料（円）").fill("110");
  await page.getByLabel("移換期間（月）").fill("2");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(page.locator("#transfer-result")).toContainText("新規掛金とは別の判断");
  await expect(page.locator("#transfer-result")).toContainText("iDeCoで継続");
  await expect(page.locator("#transfer-result")).toContainText("DCへ移換");
  await expect(page.locator("#transfer-result")).toContainText("差額");
  await expect(page.locator("#summary .cards")).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(external).toEqual([]);
  await page.getByLabel("既存資産の移換も比較する").uncheck();
  await expect(page.locator("#transfer-result")).toHaveCount(0);
});

test("custom insurer rates remain local and appear in evidence", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.url()} ${r.postData() ?? ""}`));
  await page.goto("/");
  await fill(page);
  await page.locator('[name="insurer"]').selectOption("kenpo-kumiai");
  await page.locator('[name="healthTotalRatePercent"]').fill("9.0");
  await page.locator('[name="careTotalRatePercent"]').fill("1.6");
  await page.locator('[name="childSupportTotalRatePercent"]').fill("0.2");
  await page.getByRole("button", { name: "比較する" }).click();
  await page.getByText("計算根拠", { exact: true }).click();
  await expect(page.locator("#summary")).toContainText("健康保険料率: 利用者入力");
  expect(requests.join(" ")).not.toMatch(/9\.0|1\.6|0\.2/);
});

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

test("downloads CSV without sending or storing inputs", async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto("/");
  await fill(page);
  await page.getByRole("button", { name: "比較する" }).click();
  const count =
    (await page.getByText("年次詳細", { exact: true }).locator("..").locator("table tr").count()) -
    1;
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSVをダウンロード" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("dc-lens-result.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.startsWith("\uFEFF年,年齢,入力報酬,手取り差")).toBe(true);
  expect(csv.split("\r\n")).toHaveLength(count + 2);
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe(new URL(page.url()).origin);
    expect(request.method).toBe("GET");
  }
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test("compares session scenarios without persistence or requests", async ({ page }) => {
  const requests: { url: string; method: string }[] = [];
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.goto("/");
  const initialUrl = page.url();
  await fill(page);
  await page.getByRole("button", { name: "比較する" }).click();
  await page.getByRole("button", { name: "このシナリオを比較に追加" }).click();
  await page.locator('[name="dcContribution"]').fill("10000");
  await page.getByRole("button", { name: "比較する" }).click();
  const add = page.getByRole("button", { name: "このシナリオを比較に追加" });
  await add.click();
  await expect(page.getByRole("button", { name: /シナリオ .*を削除/ })).toHaveCount(2);
  await page.getByRole("button", { name: "シナリオ 1を削除" }).click();
  await expect(page.getByRole("button", { name: /シナリオ .*を削除/ })).toHaveCount(1);
  for (let i = 0; i < 4; i++) await add.click();
  await expect(page.getByText("比較できるシナリオは4件までです。")).toBeVisible();
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]),
  ).toEqual([0, 0, ""]);
  expect(page.url()).toBe(initialUrl);
  for (const request of requests) {
    expect(new URL(request.url).origin).toBe(new URL(initialUrl).origin);
    expect(request.method).toBe("GET");
  }
});

test("warns when DC contribution exceeds the cap", async ({ page }) => {
  await page.goto("/");
  await fill(page);
  await page.locator('[name="dcContribution"]').fill("70000");
  await page.getByRole("button", { name: "比較する" }).click();
  await expect(
    page.getByText("選択制DCの月額掛金70000円は上限55000円を超えています。", { exact: false }),
  ).toBeVisible();
});
