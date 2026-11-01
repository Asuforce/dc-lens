import type { SimulationResult } from "../engine/types.ts";
import type { Dataset } from "../regulations/schema.ts";
import { chart } from "./charts.ts";

const yen = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}円`;
function node(tag: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
}
export function renderResults(
  result: SimulationResult,
  datasets: Dataset[],
  estimated: boolean,
  valuation: string,
): HTMLElement {
  const root = document.createElement("section");
  root.id = "summary";
  root.append(
    node("h2", "比較結果"),
    node(
      "p",
      "差額は選択制DC − iDeCo。正の値は選択制DC有利です。運用資産を含む生涯差は税引前評価額です。",
    ),
  );
  if (estimated) root.append(node("p", "月給は年収と賞与から推定しています。"));
  const cards = document.createElement("div");
  cards.className = "cards";
  const s = result.summary;
  for (const [label, value] of [
    ["現在の年間手取り差", yen(s.currentAnnualDifferenceYen)],
    ["退職時資産差（税引前評価額）", yen(s.retirementAssetDifferenceYen)],
    ["老齢厚生年金 年額差", yen(s.annualPensionDifferenceAtRetirementYen)],
    ["生涯累積差（名目）", yen(s.lifetimeNominalDifferenceYen)],
    ["生涯累積差（現在価値）", yen(s.lifetimePresentValueDifferenceYen)],
    [
      `損益分岐年齢（${valuation === "present-value" ? "現在価値" : "名目"}）`,
      s.breakEvenAge === null ? "なし" : `${s.breakEvenAge}歳`,
    ],
  ] as [string, string][]) {
    const card = node("div", "");
    card.append(node("h3", label), node("p", value));
    cards.append(card);
  }
  root.append(cards);
  const first = result.yearlyResults[0];
  if (first) {
    const d = document.createElement("details");
    d.append(node("summary", "現在の内訳"));
    const table = document.createElement("table");
    for (const [label, a, b] of [
      ["所得税", first.dc.breakdown.incomeTaxYen, first.ideco.breakdown.incomeTaxYen],
      ["住民税", first.dc.breakdown.residentTaxYen, first.ideco.breakdown.residentTaxYen],
      ["社会保険", first.dc.breakdown.socialInsuranceYen, first.ideco.breakdown.socialInsuranceYen],
      ["固定費", first.dc.breakdown.fixedFeeYen, first.ideco.breakdown.fixedFeeYen],
      ["信託報酬", first.dc.breakdown.trustFeeYen, first.ideco.breakdown.trustFeeYen],
    ] as [string, number, number][]) {
      const row = table.insertRow();
      for (const v of [label, `DC ${yen(a)}`, `iDeCo ${yen(b)}`]) row.insertCell().textContent = v;
    }
    d.append(table);
    root.append(d);
  }
  root.append(chart(result.yearlyResults, "cash"), chart(result.yearlyResults, "assets"));
  const details = document.createElement("details");
  details.append(node("summary", "年次詳細"));
  const table = document.createElement("table");
  const header = table.insertRow();
  for (const h of [
    "年",
    "年齢",
    "入力報酬",
    "手取り差",
    "税 DC / iDeCo",
    "社保 DC / iDeCo",
    "手数料 DC / iDeCo",
    "資産差",
    "出典 versions",
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    header.append(th);
  }
  for (const r of result.yearlyResults) {
    const row = table.insertRow();
    const d = r.dc.breakdown,
      i = r.ideco.breakdown;
    for (const value of [
      r.year,
      r.age,
      yen(r.salaryYen),
      yen(r.annualCashFlowDifferenceYen),
      `${yen(d.incomeTaxYen + d.residentTaxYen)} / ${yen(i.incomeTaxYen + i.residentTaxYen)}`,
      `${yen(d.socialInsuranceYen)} / ${yen(i.socialInsuranceYen)}`,
      `${yen(d.fixedFeeYen + d.trustFeeYen)} / ${yen(i.fixedFeeYen + i.trustFeeYen)}`,
      yen(r.investmentBalanceDifferenceYen),
      r.dc.sources.join(" / "),
    ])
      row.insertCell().textContent = String(value);
  }
  details.append(table);
  root.append(details);
  const evidence = document.createElement("details");
  evidence.append(
    node("summary", "計算根拠"),
    node("p", `制度データ版: ${result.regulationVersion}`),
    node("h3", "前提"),
  );
  const list = document.createElement("ul");
  for (const a of result.assumptions) list.append(node("li", a));
  evidence.append(list, node("h3", "出典"));
  const sources = document.createElement("ul");
  for (const d of datasets.filter((d) =>
    result.regulationVersion.includes(`${d.meta.kind}:${d.meta.version}`),
  )) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = d.meta.sourceUrl;
    a.textContent = d.meta.sourceName;
    li.append(a, document.createTextNode(`（${d.meta.version}、検証日 ${d.meta.verifiedAt}）`));
    sources.append(li);
  }
  evidence.append(sources);
  root.append(evidence, node("h3", "注意事項"));
  const warnings = document.createElement("ul");
  for (const w of result.warnings) warnings.append(node("li", w));
  root.append(warnings);
  return root;
}
