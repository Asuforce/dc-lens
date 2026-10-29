import type { YearlyResult } from "../engine/types.ts";

const ns = "http://www.w3.org/2000/svg";
export function scaleRange(values: number[]): { min: number; max: number } {
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values);
  return min === max ? { min: 0, max: 1 } : { min, max };
}
export function chart(rows: YearlyResult[], kind: "cash" | "assets"): HTMLElement {
  const wrap = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent =
    kind === "cash" ? "年齢別 年間キャッシュフロー差" : "両制度の運用資産推移（税引前評価額）";
  wrap.append(heading);
  const series =
    kind === "cash"
      ? [rows.map((r) => r.annualCashFlowDifferenceYen)]
      : [rows.map((r) => r.dc.investmentBalanceYen), rows.map((r) => r.ideco.investmentBalanceYen)];
  const { min, max } = scaleRange(series.flat());
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 600 260");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", heading.textContent);
  const title = document.createElementNS(ns, "title");
  title.textContent = heading.textContent;
  const desc = document.createElementNS(ns, "desc");
  desc.textContent = "数値は直後の表でも確認できます。実線は選択制DC、破線はiDeCoです。";
  svg.append(title, desc);
  const x = (i: number) => 60 + (i * 520) / Math.max(1, rows.length - 1),
    y = (v: number) => 220 - ((v - min) / (max - min)) * 190;
  for (const v of [min, 0, max]) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", "60");
    line.setAttribute("x2", "580");
    line.setAttribute("y1", String(y(v)));
    line.setAttribute("y2", String(y(v)));
    line.setAttribute("class", "axis");
    svg.append(line);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", "2");
    t.setAttribute("y", String(y(v)));
    t.textContent = Math.round(v).toLocaleString();
    svg.append(t);
  }
  series.forEach((values, j) => {
    const p = document.createElementNS(ns, "polyline");
    p.setAttribute("points", values.map((v, i) => `${x(i)},${y(v)}`).join(" "));
    p.setAttribute("class", j === 0 ? "series first" : "series second");
    svg.append(p);
  });
  for (const i of [0, rows.length - 1]) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x(i)));
    t.setAttribute("y", "245");
    t.textContent = `${rows[i]?.age ?? ""}歳`;
    svg.append(t);
  }
  wrap.append(svg);
  if (kind === "assets") {
    const legend = document.createElement("p");
    legend.textContent = "実線：選択制DC / 破線：iDeCo";
    wrap.append(legend);
  }
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "グラフの数値を表で見る";
  details.append(summary);
  const table = document.createElement("table");
  const header = table.insertRow();
  for (const label of kind === "cash"
    ? ["年齢", "年間差（円）"]
    : ["年齢", "選択制DC（円）", "iDeCo（円）"]) {
    const th = document.createElement("th");
    th.textContent = label;
    header.append(th);
  }
  rows.forEach((r, i) => {
    const tr = table.insertRow();
    for (const value of [r.age, ...series.map((s) => s[i] ?? 0)]) {
      const td = tr.insertCell();
      td.textContent = value.toLocaleString();
    }
  });
  details.append(table);
  wrap.append(details);
  return wrap;
}
