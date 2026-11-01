export const DATASET_STATUSES = ["verified", "planned", "provisional"] as const;
export type DatasetStatus = (typeof DATASET_STATUSES)[number];

export const DATASET_KINDS = [
  "pension-insurance",
  "health-insurance",
  "income-tax",
  "resident-tax",
  "pension-benefit",
  "contribution-limit",
] as const;
export type DatasetKind = (typeof DATASET_KINDS)[number];

export interface DatasetMeta {
  version: string;
  kind: DatasetKind;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string | null;
  status: DatasetStatus;
  insurer?: string;
  note?: string;
}

export interface Grade {
  grade: number;
  standardMonthlyYen: number;
  lowerBoundYen: number;
  upperBoundYen: number | null;
}

export interface GradeTable {
  grades: Grade[];
}

export interface PensionInsurancePayload extends GradeTable {
  totalRatePercent: number;
  bonusCapPerMonthYen: number;
}

export interface HealthInsurancePayload extends GradeTable {
  annualBonusCapYen: number;
  careTotalRatePercent: number;
  childSupportTotalRatePercent: number;
  healthTotalRatePercentByPrefecture: Record<string, number>;
}

export interface Bracket {
  overYen: number;
  upToYen: number | null;
}

export interface SalaryDeductionBracket extends Bracket {
  ratePercent: number;
  constantYen: number;
}

export interface BasicDeductionBracket extends Bracket {
  deductionYen: number;
}

export interface IncomeTaxBracket extends Bracket {
  ratePercent: number;
  deductionYen: number;
}

export interface IncomeTaxPayload {
  salaryDeductionBrackets: SalaryDeductionBracket[];
  salaryDeductionMinimumYen: number;
  basicDeductionBrackets: BasicDeductionBracket[];
  taxBrackets: IncomeTaxBracket[];
  surtaxTotalPercent: number;
}

export interface ResidentTaxPayload {
  incomeLevyPercent: number;
  perCapitaLevyYen: number;
  salaryDeductionBrackets: SalaryDeductionBracket[];
  salaryDeductionMinimumYen: number;
  basicDeductionBrackets: BasicDeductionBracket[];
}

export interface ContributionLimitPayload {
  dcMonthlyYen: number;
  idecoMonthlyYen: number;
}

export interface PensionBenefitPayload {
  multiplierPerMille: number;
}

export interface Dataset<P = unknown> {
  meta: DatasetMeta;
  payload: P;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));
}

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateMeta(raw: unknown): ValidationResult<DatasetMeta> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["meta must be an object"] };

  const str = (key: string): string => {
    const v = raw[key];
    if (typeof v !== "string" || v === "") errors.push(`meta.${key} must be a non-empty string`);
    return typeof v === "string" ? v : "";
  };

  const version = str("version");
  const sourceName = str("sourceName");
  const kind = raw.kind;
  if (!DATASET_KINDS.includes(kind as DatasetKind)) errors.push("meta.kind is not a known kind");

  const status = raw.status;
  if (!DATASET_STATUSES.includes(status as DatasetStatus)) {
    errors.push("meta.status must be verified, planned or provisional");
  }

  if (!isIsoDate(raw.effectiveFrom)) errors.push("meta.effectiveFrom must be YYYY-MM-DD");
  if (raw.effectiveTo !== null && !isIsoDate(raw.effectiveTo)) {
    errors.push("meta.effectiveTo must be YYYY-MM-DD or null");
  }
  if (!isHttpsUrl(raw.sourceUrl)) errors.push("meta.sourceUrl must be an https URL");

  if (raw.verifiedAt !== null && !isIsoDate(raw.verifiedAt)) {
    errors.push("meta.verifiedAt must be YYYY-MM-DD or null");
  }
  if (status === "verified" && raw.verifiedAt === null) {
    errors.push("meta.verifiedAt is required when status is verified");
  }
  if (
    isIsoDate(raw.effectiveFrom) &&
    isIsoDate(raw.effectiveTo) &&
    raw.effectiveTo < raw.effectiveFrom
  ) {
    errors.push("meta.effectiveTo must not precede effectiveFrom");
  }

  if (errors.length > 0) return { ok: false, errors };
  const meta: DatasetMeta = {
    version,
    kind: kind as DatasetKind,
    effectiveFrom: raw.effectiveFrom as string,
    effectiveTo: raw.effectiveTo as string | null,
    sourceName,
    sourceUrl: raw.sourceUrl as string,
    verifiedAt: raw.verifiedAt as string | null,
    status: status as DatasetStatus,
  };
  if (typeof raw.insurer === "string") meta.insurer = raw.insurer;
  if (typeof raw.note === "string") meta.note = raw.note;
  return { ok: true, value: meta };
}

export function validateGradeTable(raw: unknown): ValidationResult<GradeTable> {
  const errors: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.grades) || raw.grades.length === 0) {
    return { ok: false, errors: ["payload.grades must be a non-empty array"] };
  }
  const list: unknown[] = raw.grades;
  const grades: Grade[] = [];
  let prevUpper: number | null = 0;
  list.forEach((g, i) => {
    if (!isRecord(g)) {
      errors.push(`grades[${i}] must be an object`);
      return;
    }
    const { grade, standardMonthlyYen, lowerBoundYen, upperBoundYen } = g;
    const ints = [grade, standardMonthlyYen, lowerBoundYen];
    if (!ints.every((n) => Number.isInteger(n) && (n as number) >= 0)) {
      errors.push(`grades[${i}] needs integer grade, standardMonthlyYen, lowerBoundYen`);
      return;
    }
    if (upperBoundYen !== null && !Number.isInteger(upperBoundYen)) {
      errors.push(`grades[${i}].upperBoundYen must be an integer or null`);
      return;
    }
    if (grade !== i + 1) errors.push(`grades[${i}].grade must be ${i + 1}`);
    if (prevUpper !== null && i > 0 && lowerBoundYen !== prevUpper) {
      errors.push(`grades[${i}] lower bound must equal the previous upper bound`);
    }
    if (upperBoundYen === null && i !== list.length - 1) {
      errors.push(`grades[${i}] has no upper bound but is not the last grade`);
    }
    prevUpper = upperBoundYen as number | null;
    grades.push({
      grade: grade as number,
      standardMonthlyYen: standardMonthlyYen as number,
      lowerBoundYen: lowerBoundYen as number,
      upperBoundYen: upperBoundYen as number | null,
    });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { grades } };
}

function isNonNegInt(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

function hasAtMostThreeDecimals(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;
}

function isRate(v: unknown): v is number {
  return typeof v === "number" && v >= 0 && v <= 100 && hasAtMostThreeDecimals(v);
}

function checkBrackets(label: string, raw: unknown, errors: string[]): Record<string, unknown>[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  raw.forEach((row: unknown, i: number) => {
    if (!isRecord(row)) {
      errors.push(`${label}[${i}] must be an object`);
      return;
    }
    if (!isNonNegInt(row.overYen)) errors.push(`${label}[${i}].overYen must be an integer`);
    if (row.upToYen !== null && !isNonNegInt(row.upToYen)) {
      errors.push(`${label}[${i}].upToYen must be an integer or null`);
    }
    const prev = rows[i - 1];
    if (i === 0 && row.overYen !== 0) errors.push(`${label}[0].overYen must be 0`);
    if (prev && prev.upToYen !== row.overYen) {
      errors.push(`${label}[${i}].overYen must equal the previous upToYen`);
    }
    if (row.upToYen === null && i !== raw.length - 1) {
      errors.push(`${label}[${i}] is open-ended but not last`);
    }
    if (i === raw.length - 1 && row.upToYen !== null) {
      errors.push(`${label}[${i}] must be open-ended (upToYen null)`);
    }
    rows.push(row);
  });
  return rows;
}

function finish<T>(errors: string[], value: unknown): ValidationResult<T> {
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: value as T };
}

export function validatePensionInsurance(raw: unknown): ValidationResult<PensionInsurancePayload> {
  const grades = validateGradeTable(raw);
  if (!grades.ok) return grades;
  const errors: string[] = [];
  const r = raw as Record<string, unknown>;
  if (!isRate(r.totalRatePercent)) errors.push("totalRatePercent must be a rate with <=3 decimals");
  if (!isNonNegInt(r.bonusCapPerMonthYen)) errors.push("bonusCapPerMonthYen must be an integer");
  return finish(errors, raw);
}

export function validateHealthInsurance(raw: unknown): ValidationResult<HealthInsurancePayload> {
  const grades = validateGradeTable(raw);
  if (!grades.ok) return grades;
  const errors: string[] = [];
  const r = raw as Record<string, unknown>;
  if (!isNonNegInt(r.annualBonusCapYen)) errors.push("annualBonusCapYen must be an integer");
  if (!isRate(r.careTotalRatePercent)) errors.push("careTotalRatePercent must be a rate");
  if (!isRate(r.childSupportTotalRatePercent))
    errors.push("childSupportTotalRatePercent must be a rate");
  const byPref = r.healthTotalRatePercentByPrefecture;
  if (!isRecord(byPref) || Object.keys(byPref).length === 0) {
    errors.push("healthTotalRatePercentByPrefecture must be a non-empty object");
  } else {
    for (const [k, v] of Object.entries(byPref)) {
      if (!isRate(v)) errors.push(`healthTotalRatePercentByPrefecture.${k} must be a rate`);
    }
  }
  return finish(errors, raw);
}

function checkSalaryDeduction(raw: Record<string, unknown>, errors: string[]): void {
  const rows = checkBrackets("salaryDeductionBrackets", raw.salaryDeductionBrackets, errors);
  rows.forEach((row, i) => {
    if (!isRate(row.ratePercent)) errors.push(`salaryDeductionBrackets[${i}].ratePercent invalid`);
    if (!Number.isInteger(row.constantYen)) {
      errors.push(`salaryDeductionBrackets[${i}].constantYen must be an integer`);
    }
  });
  if (!isNonNegInt(raw.salaryDeductionMinimumYen)) {
    errors.push("salaryDeductionMinimumYen must be an integer");
  }
}

function checkBasicDeduction(raw: Record<string, unknown>, errors: string[]): void {
  const rows = checkBrackets("basicDeductionBrackets", raw.basicDeductionBrackets, errors);
  rows.forEach((row, i) => {
    if (!isNonNegInt(row.deductionYen)) {
      errors.push(`basicDeductionBrackets[${i}].deductionYen must be an integer`);
    }
  });
}

export function validateIncomeTax(raw: unknown): ValidationResult<IncomeTaxPayload> {
  if (!isRecord(raw)) return { ok: false, errors: ["payload must be an object"] };
  const errors: string[] = [];
  checkSalaryDeduction(raw, errors);
  checkBasicDeduction(raw, errors);
  const rows = checkBrackets("taxBrackets", raw.taxBrackets, errors);
  rows.forEach((row, i) => {
    if (!isRate(row.ratePercent)) errors.push(`taxBrackets[${i}].ratePercent invalid`);
    if (!isNonNegInt(row.deductionYen))
      errors.push(`taxBrackets[${i}].deductionYen must be an integer`);
  });
  if (!isRate(raw.surtaxTotalPercent)) errors.push("surtaxTotalPercent invalid");
  return finish(errors, raw);
}

export function validateResidentTax(raw: unknown): ValidationResult<ResidentTaxPayload> {
  if (!isRecord(raw)) return { ok: false, errors: ["payload must be an object"] };
  const errors: string[] = [];
  checkSalaryDeduction(raw, errors);
  checkBasicDeduction(raw, errors);
  if (!isRate(raw.incomeLevyPercent)) errors.push("incomeLevyPercent invalid");
  if (!isNonNegInt(raw.perCapitaLevyYen)) errors.push("perCapitaLevyYen must be an integer");
  return finish(errors, raw);
}

export function validatePensionBenefit(raw: unknown): ValidationResult<PensionBenefitPayload> {
  if (!isRecord(raw)) return { ok: false, errors: ["payload must be an object"] };
  const v = raw.multiplierPerMille;
  const errors =
    typeof v === "number" && v > 0 && v < 100 && hasAtMostThreeDecimals(v)
      ? []
      : ["multiplierPerMille must be a positive number with <=3 decimals"];
  return finish(errors, raw);
}

export function validateContributionLimit(
  raw: unknown,
): ValidationResult<ContributionLimitPayload> {
  if (!isRecord(raw)) return { ok: false, errors: ["payload must be an object"] };
  const errors: string[] = [];
  for (const key of ["dcMonthlyYen", "idecoMonthlyYen"]) {
    if (!isNonNegInt(raw[key]) || raw[key] === 0) errors.push(`${key} must be a positive integer`);
  }
  return finish(errors, raw);
}

const PAYLOAD_VALIDATORS: Record<DatasetKind, (raw: unknown) => ValidationResult<unknown>> = {
  "pension-insurance": validatePensionInsurance,
  "health-insurance": validateHealthInsurance,
  "income-tax": validateIncomeTax,
  "resident-tax": validateResidentTax,
  "pension-benefit": validatePensionBenefit,
  "contribution-limit": validateContributionLimit,
};

export function validateDataset(raw: unknown): ValidationResult<Dataset> {
  if (!isRecord(raw)) return { ok: false, errors: ["dataset must be an object"] };
  const meta = validateMeta(raw.meta);
  if (!meta.ok) return meta;
  const payload = PAYLOAD_VALIDATORS[meta.value.kind](raw.payload);
  if (!payload.ok) return payload;
  return { ok: true, value: { meta: meta.value, payload: payload.value } };
}
