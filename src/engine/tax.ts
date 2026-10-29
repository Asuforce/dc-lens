import type {
  Bracket,
  IncomeTaxPayload,
  ResidentTaxPayload,
  SalaryDeductionBracket,
} from "../regulations/schema.ts";

export function findBracket<T extends Bracket>(rows: readonly T[], amountYen: number): T {
  if (!Number.isInteger(amountYen) || amountYen < 0) throw new RangeError("Invalid amount");
  const row =
    amountYen === 0
      ? rows[0]
      : rows.find((r) => r.overYen < amountYen && (r.upToYen === null || amountYen <= r.upToYen));
  if (!row) throw new RangeError("No matching bracket");
  return row;
}

function rate(amount: number, percent: number): number {
  return Math.floor((amount * Math.round(percent * 1000)) / 100000);
}

export function salaryDeductionYen(
  grossYen: number,
  p: { salaryDeductionBrackets: SalaryDeductionBracket[]; salaryDeductionMinimumYen: number },
): number {
  const band = findBracket(p.salaryDeductionBrackets, grossYen);
  return Math.min(
    grossYen,
    Math.max(rate(grossYen, band.ratePercent) + band.constantYen, p.salaryDeductionMinimumYen),
  );
}
export function floorTo(unit: number, amountYen: number): number {
  return Math.floor(Math.max(0, amountYen) / unit) * unit;
}
export interface TaxInput {
  grossSalaryYen: number;
  socialInsuranceYen: number;
  smallBusinessMutualAidYen: number;
}
export interface IncomeTaxResult {
  salaryDeductionYen: number;
  employmentIncomeYen: number;
  basicDeductionYen: number;
  taxableIncomeYen: number;
  baseTaxYen: number;
  surtaxYen: number;
  totalYen: number;
  warnings: string[];
}
export interface ResidentTaxResult {
  salaryDeductionYen: number;
  employmentIncomeYen: number;
  basicDeductionYen: number;
  taxableIncomeYen: number;
  incomeLevyYen: number;
  perCapitaLevyYen: number;
  totalYen: number;
  warnings: string[];
}
const warning =
  "給与所得控除は速算表による概算です(660万円未満は別表第五で求める制度のため、数円から数千円の差が出ることがあります)。";
function common(input: TaxInput, p: IncomeTaxPayload | ResidentTaxPayload) {
  const deduction = salaryDeductionYen(input.grossSalaryYen, p);
  const employment = input.grossSalaryYen - deduction;
  const basic = findBracket(p.basicDeductionBrackets, employment).deductionYen;
  return {
    salaryDeductionYen: deduction,
    employmentIncomeYen: employment,
    basicDeductionYen: basic,
    taxableIncomeYen: floorTo(
      1000,
      employment - input.socialInsuranceYen - input.smallBusinessMutualAidYen - basic,
    ),
  };
}
export function incomeTax(input: TaxInput, p: IncomeTaxPayload): IncomeTaxResult {
  const result = common(input, p);
  const bracket = findBracket(p.taxBrackets, result.taxableIncomeYen);
  const baseTaxYen = Math.max(
    0,
    rate(result.taxableIncomeYen, bracket.ratePercent) - bracket.deductionYen,
  );
  const surtaxYen = rate(baseTaxYen, p.surtaxTotalPercent);
  return {
    ...result,
    baseTaxYen,
    surtaxYen,
    totalYen: floorTo(100, baseTaxYen + surtaxYen),
    warnings: input.grossSalaryYen < 6600000 ? [warning] : [],
  };
}
export function residentTax(input: TaxInput, p: ResidentTaxPayload): ResidentTaxResult {
  const result = common(input, p);
  const incomeLevyYen = floorTo(100, rate(result.taxableIncomeYen, p.incomeLevyPercent));
  return {
    ...result,
    incomeLevyYen,
    perCapitaLevyYen: p.perCapitaLevyYen,
    totalYen: incomeLevyYen + p.perCapitaLevyYen,
    warnings: ["調整控除は未対応です。", ...(input.grossSalaryYen < 6600000 ? [warning] : [])],
  };
}
