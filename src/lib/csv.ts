import type { SimulationResult } from "../engine/types.ts";

const headers = [
  "年",
  "年齢",
  "入力報酬",
  "手取り差",
  "DC所得税",
  "DC住民税",
  "DC社会保険",
  "DC固定費",
  "DC信託報酬",
  "iDeCo所得税",
  "iDeCo住民税",
  "iDeCo社会保険",
  "iDeCo固定費",
  "iDeCo信託報酬",
  "資産差(税引前評価額)",
  "年金年額差",
  "累積差(名目)",
  "累積差(現在価値)",
  "制度データ版",
];

function cell(value: string | number): string {
  let text = typeof value === "number" ? String(Math.round(value)) : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultToCsv(result: SimulationResult): string {
  const rows: (string | number)[][] = [headers];
  for (const r of result.yearlyResults) {
    const d = r.dc.breakdown;
    const i = r.ideco.breakdown;
    rows.push([
      r.year,
      r.age,
      r.salaryYen,
      r.annualCashFlowDifferenceYen,
      d.incomeTaxYen,
      d.residentTaxYen,
      d.socialInsuranceYen,
      d.fixedFeeYen,
      d.trustFeeYen,
      i.incomeTaxYen,
      i.residentTaxYen,
      i.socialInsuranceYen,
      i.fixedFeeYen,
      i.trustFeeYen,
      r.investmentBalanceDifferenceYen,
      r.annualPensionBenefitDifferenceYen,
      r.cumulativeNominalDifferenceYen,
      r.cumulativePresentValueDifferenceYen,
      result.regulationVersion,
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
