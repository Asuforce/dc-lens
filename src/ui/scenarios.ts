import type { SimulationSummary } from "../engine/types.ts";

export interface ScenarioEntry {
  id: number;
  label: string;
  valuation: "nominal" | "present-value";
  regulationVersion: string;
  summary: SimulationSummary;
  contributions: { dcMonthlyYen: number; idecoMonthlyYen: number };
  grossAnnualReturn: number;
}

export const defaultLabel = (n: number): string => `シナリオ ${n}`;
export function addScenario(list: ScenarioEntry[], entry: ScenarioEntry, max = 4): ScenarioEntry[] {
  if (list.length >= max) return list;
  return [
    ...list,
    { ...entry, label: entry.label.trim().slice(0, 40).trim() || defaultLabel(entry.id) },
  ];
}
export function removeScenario(list: ScenarioEntry[], id: number): ScenarioEntry[] {
  return list.filter((entry) => entry.id !== id);
}
export function renderScenarioTable(
  list: ScenarioEntry[],
  onRemove: (id: number) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "chart-scroll";
  const table = document.createElement("table");
  const header = table.insertRow();
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.textContent = "項目";
  header.append(corner);
  for (const entry of list) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = entry.label;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "削除";
    button.setAttribute("aria-label", `${entry.label}を削除`);
    button.addEventListener("click", () => onRemove(entry.id));
    th.append(document.createElement("br"), button);
    header.append(th);
  }
  const yen = (n: number) => `${Math.round(n).toLocaleString()}円`;
  const rows: [string, (entry: ScenarioEntry) => string][] = [
    ["現在の年間手取り差", (e) => yen(e.summary.currentAnnualDifferenceYen)],
    ["退職時資産差（税引前評価額）", (e) => yen(e.summary.retirementAssetDifferenceYen)],
    ["老齢厚生年金 年額差", (e) => yen(e.summary.annualPensionDifferenceAtRetirementYen)],
    ["生涯累積差（名目）", (e) => yen(e.summary.lifetimeNominalDifferenceYen)],
    ["生涯累積差（現在価値）", (e) => yen(e.summary.lifetimePresentValueDifferenceYen)],
    [
      "損益分岐年齢",
      (e) =>
        `${e.summary.breakEvenAge === null ? "なし" : `${e.summary.breakEvenAge}歳`}（${e.valuation === "nominal" ? "名目" : "現在価値"}）`,
    ],
    ["評価基準", (e) => (e.valuation === "nominal" ? "名目" : "現在価値")],
    [
      "掛金（DC / iDeCo 月額）",
      (e) => `${yen(e.contributions.dcMonthlyYen)} / ${yen(e.contributions.idecoMonthlyYen)}`,
    ],
    ["想定利回り", (e) => `${e.grossAnnualReturn * 100}%`],
    ["制度データ版", (e) => e.regulationVersion],
  ];
  for (const [label, value] of rows) {
    const row = table.insertRow();
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    row.append(th);
    for (const entry of list) row.insertCell().textContent = value(entry);
  }
  wrapper.append(table);
  return wrapper;
}
