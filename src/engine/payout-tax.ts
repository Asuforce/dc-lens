import type { RegulationSet } from "../regulations/loader.ts";
import { findBracket, floorTo } from "./tax.ts";
import type { SimulationInput, SimulationResult } from "./types.ts";

export interface LumpSumTaxResult {
  deductionYen: number;
  retirementIncomeYen: number;
  taxableRetirementIncomeYen: number;
  incomeTaxYen: number;
  residentTaxPrefecturalYen: number;
  residentTaxMunicipalYen: number;
  residentTaxYen: number;
  totalTaxYen: number;
  afterTaxYen: number;
}

export function lumpSumTax(
  { lumpSumYen, serviceYears }: { lumpSumYen: number; serviceYears: number },
  set: RegulationSet,
): LumpSumTaxResult {
  if (
    !Number.isSafeInteger(lumpSumYen) ||
    lumpSumYen < 0 ||
    !Number.isFinite(serviceYears) ||
    serviceYears < 0
  )
    throw new RangeError("Invalid payout");
  const p = set.retirementIncome;
  const years = Math.ceil(serviceYears);
  const deductionYen =
    years <= 20
      ? Math.max(p.deductionMinimumYen, p.deductionPerYearUpTo20Yen * years)
      : p.deductionBaseAt20YearsYen + p.deductionPerYearOver20Yen * (years - 20);
  const retirementIncomeYen = Math.max(0, lumpSumYen - deductionYen) / p.taxableFractionDenominator;
  const taxableRetirementIncomeYen = floorTo(1000, retirementIncomeYen);
  const bracket = findBracket(set.incomeTax.taxBrackets, taxableRetirementIncomeYen);
  const base = Math.max(
    0,
    Math.floor((taxableRetirementIncomeYen * bracket.ratePercent) / 100) - bracket.deductionYen,
  );
  const incomeTaxYen = Math.floor((base * (100 + set.incomeTax.surtaxTotalPercent)) / 100);
  const residentTaxPrefecturalYen = floorTo(
    100,
    (taxableRetirementIncomeYen * p.residentPrefecturalPercent) / 100,
  );
  const residentTaxMunicipalYen = floorTo(
    100,
    (taxableRetirementIncomeYen * p.residentMunicipalPercent) / 100,
  );
  const residentTaxYen = residentTaxPrefecturalYen + residentTaxMunicipalYen;
  const totalTaxYen = incomeTaxYen + residentTaxYen;
  return {
    deductionYen,
    retirementIncomeYen,
    taxableRetirementIncomeYen,
    incomeTaxYen,
    residentTaxPrefecturalYen,
    residentTaxMunicipalYen,
    residentTaxYen,
    totalTaxYen,
    afterTaxYen: lumpSumYen - totalTaxYen,
  };
}

export function afterTaxPayout(
  result: SimulationResult,
  input: SimulationInput,
  priorServiceYears: number,
  set: RegulationSet,
) {
  if (!Number.isSafeInteger(priorServiceYears) || priorServiceYears < 0)
    throw new RangeError("既存の拠出年数は0以上の整数にしてください。");
  const row = result.yearlyResults.findLast((r) => r.age < input.profile.retirementAge);
  if (!row) throw new RangeError("退職前の結果がありません。");
  const serviceYears = input.profile.retirementAge - input.profile.age + priorServiceYears;
  const dc = lumpSumTax({ lumpSumYen: row.dc.investmentBalanceYen, serviceYears }, set);
  const ideco = lumpSumTax({ lumpSumYen: row.ideco.investmentBalanceYen, serviceYears }, set);
  return {
    dc,
    ideco,
    afterTaxDifferenceYen: dc.afterTaxYen - ideco.afterTaxYen,
    serviceYears,
    warnings: [
      "短期退職手当等、特定役員退職手当等、障害者退職の加算、過去の退職手当との勤続期間の重複控除、他の退職金との合算、確定申告での他所得との選択は対象外です。",
      "勤続5年以下は短期退職手当等に当たり得ます。",
      "年金受取は未対応です。2048年以降の税率変更は対象外です。",
      "既存の税引前系列は変更しません。",
    ],
    assumptions: ["勤続年数は掛金拠出期間とし、DCとiDeCoで同じと仮定します。退職年の名目額です。"],
  };
}
