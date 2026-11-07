import { projectQuickBalances } from "../engine/quick.ts";
import { simulate } from "../engine/simulate.ts";
import type { RegulationSet } from "../regulations/loader.ts";
import { parseForm } from "./state.ts";

export function createQuickForm(
  set: RegulationSet,
  output: HTMLElement,
  errors: HTMLElement,
): HTMLFormElement {
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "form-grid";
  for (const [name, title] of [
    ["income", "年収（税込み・円）"],
    ["contribution", "毎月の積立額（円）"],
    ["balance", "現在の積立残高（円）"],
  ] as const) {
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.name = name;
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.required = true;
    label.append(input);
    grid.append(label);
  }
  const note = document.createElement("p");
  note.textContent =
    "概算条件：40歳未満・協会けんぽ東京、年収を12分割した月給（端数は賞与）、昇給なし。運用は年率3%、コスト・固定費は未反映。加入資格・拠出上限は勤務先等で確認してください。";
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "概算する";
  form.append(grid, note, button);
  const run = () => {
    errors.textContent = "";
    output.replaceChildren();
    const data = new FormData(form);
    const values = ["income", "contribution", "balance"].map((key) => {
      const raw = String(data.get(key) ?? "");
      return raw.trim() === "" ? NaN : Number(raw);
    });
    const [income = NaN, contribution = NaN, balance = NaN] = values;
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0) || income <= 0) {
      errors.textContent =
        "3項目を整数円で入力してください。年収は1円以上、積立額・残高は0円以上です。";
      errors.focus();
      return;
    }
    const monthly = Math.floor(income / 12);
    const parsed = parseForm({
      age: "30",
      retirementAge: "31",
      pensionStartAge: "65",
      pensionEndAge: "66",
      annualIncome: String(income),
      monthlySalary: String(monthly),
      bonus: String(income - monthly * 12),
      raiseRate: "0",
      events: [],
      bonusMode: "fixed-ratio",
      prefecture: "tokyo",
      dcContribution: String(contribution),
      idecoContribution: String(contribution),
      dcCost: "0",
      idecoCost: "0",
      fixedFee: "0",
      grossReturn: "3",
      inflation: "0",
      discount: "0",
      valuation: "nominal",
      regulationVersion: set.versions.join(" / "),
    });
    if (!parsed.ok) {
      errors.textContent = parsed.errors.join(" / ");
      return;
    }
    try {
      const result = simulate(parsed.input, set);
      const heading = document.createElement("h2");
      heading.textContent = "簡易シミュレーション";
      const summary = document.createElement("p");
      const yen = (value: number) => `${value.toLocaleString("ja-JP")}円`;
      summary.textContent = `年間の手取り差（選択制DC − iDeCo）：${yen(result.summary.currentAnnualDifferenceYen)}。正の値はDCの手取りが多いことを示します。`;
      const table = document.createElement("table");
      table.innerHTML =
        "<caption>積立残高の推移（名目・税引前、両制度共通）</caption><thead><tr><th scope='col'>経過年数</th><th scope='col'>新規積立分</th><th scope='col'>現在の残高分</th><th scope='col'>合計</th></tr></thead>";
      const body = document.createElement("tbody");
      for (const point of projectQuickBalances(balance, contribution)) {
        const row = document.createElement("tr");
        for (const value of [
          `${point.year}年後`,
          yen(point.fresh),
          yen(point.existing),
          yen(point.total),
        ]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        body.append(row);
      }
      table.append(body);
      const notes = document.createElement("p");
      notes.textContent = `制度データ：${result.regulationVersion}。既存残高は移換せず保有継続する仮定です。手取り差を再投資していません。同じ利回り・コスト条件のため運用残高は両制度共通です。実際の手数料、介護保険、扶養等で結果は変わります。将来利回りの保証はありません。年金減少・生涯差・逆転年齢は詳細入力で確認してください。`;
      const assumptions = document.createElement("details");
      const title = document.createElement("summary");
      title.textContent = "計算の仮定と注意事項";
      const list = document.createElement("ul");
      for (const text of [...result.assumptions, ...result.warnings]) {
        const item = document.createElement("li");
        item.textContent = text;
        list.append(item);
      }
      assumptions.append(title, list);
      output.append(heading, summary, table, notes, assumptions);
    } catch (error) {
      errors.textContent = error instanceof Error ? error.message : "計算できませんでした。";
    }
  };
  let submitted = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitted = true;
    run();
  });
  form.addEventListener("input", () => {
    if (submitted) run();
  });
  return form;
}
