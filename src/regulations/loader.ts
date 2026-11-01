import type {
  ContributionLimitPayload,
  Dataset,
  DatasetKind,
  DatasetStatus,
  HealthInsurancePayload,
  IncomeTaxPayload,
  PensionBenefitPayload,
  PensionInsurancePayload,
  ResidentTaxPayload,
  RetirementIncomePayload,
} from "./schema.ts";
import { validateDataset } from "./schema.ts";

export type CalculationMode = "precise" | "draft";

export type SelectResult =
  | { ok: true; dataset: Dataset }
  | { ok: false; reason: "missing" | "not-verified" | "invalid"; detail: string };

export function parseDatasets(rawList: readonly unknown[]): Dataset[] {
  return rawList.map((raw, i) => {
    const r = validateDataset(raw);
    if (!r.ok) throw new Error(`dataset #${i}: ${r.errors.join("; ")}`);
    return r.value;
  });
}

export function selectDataset(
  datasets: readonly Dataset[],
  kind: DatasetKind,
  date: string,
  mode: CalculationMode,
  insurer?: string,
): SelectResult {
  const candidates = datasets.filter(
    (d) =>
      d.meta.kind === kind &&
      d.meta.effectiveFrom <= date &&
      (d.meta.effectiveTo === null || date <= d.meta.effectiveTo) &&
      (insurer === undefined || d.meta.insurer === insurer),
  );
  const [first] = candidates;
  if (first === undefined) {
    return { ok: false, reason: "missing", detail: `${kind} for ${date} is not available` };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: "invalid", detail: `${kind} for ${date} matches several datasets` };
  }
  if (mode === "precise" && first.meta.status !== "verified") {
    return {
      ok: false,
      reason: "not-verified",
      detail: `${kind} ${first.meta.version} is ${first.meta.status}, not verified`,
    };
  }
  return { ok: true, dataset: first };
}

export interface RegulationSet {
  baseDate: string;
  insurer: string;
  pension: PensionInsurancePayload;
  health: HealthInsurancePayload;
  incomeTax: IncomeTaxPayload;
  residentTax: ResidentTaxPayload;
  retirementIncome: RetirementIncomePayload;
  pensionBenefit: PensionBenefitPayload;
  contributionLimit: {
    payload: ContributionLimitPayload;
    version: string;
    status: DatasetStatus;
  } | null;
  versions: string[];
  warnings: string[];
}

export type ResolveResult = { ok: true; set: RegulationSet } | { ok: false; errors: string[] };

const SET_KINDS: readonly DatasetKind[] = [
  "pension-insurance",
  "health-insurance",
  "income-tax",
  "resident-tax",
  "pension-benefit",
  "retirement-income",
];

export function resolveRegulationSet(
  datasets: readonly Dataset[],
  baseDate: string,
  mode: CalculationMode,
  insurer = "kyokai-kenpo",
): ResolveResult {
  const errors: string[] = [];
  const picked = new Map<DatasetKind, Dataset>();
  for (const kind of SET_KINDS) {
    const r = selectDataset(
      datasets,
      kind,
      baseDate,
      mode,
      kind === "health-insurance" ? insurer : undefined,
    );
    if (r.ok) picked.set(kind, r.dataset);
    else errors.push(r.detail);
  }
  if (errors.length > 0) return { ok: false, errors };

  const limit = selectDataset(datasets, "contribution-limit", baseDate, "draft");
  if (limit.ok && limit.dataset.meta.status !== "provisional") {
    picked.set("contribution-limit", limit.dataset);
  }
  const get = <P>(kind: DatasetKind): P => (picked.get(kind) as Dataset<P>).payload;
  const warnings: string[] = [
    `制度は基準日 ${baseDate} 時点の内容で固定し、将来の改正は反映していません。`,
  ];
  for (const d of datasets) {
    if (
      d.meta.effectiveFrom > baseDate &&
      (SET_KINDS.includes(d.meta.kind) || d.meta.kind === "contribution-limit")
    ) {
      warnings.push(
        `${d.meta.kind} ${d.meta.version} (${d.meta.effectiveFrom} 施行予定) は反映していません。`,
      );
    }
  }
  if (!picked.has("contribution-limit"))
    warnings.push("拠出限度額の制度データがないため、限度額は確認していません。");
  for (const d of picked.values()) {
    if (d.meta.effectiveTo !== null) {
      warnings.push(
        `${d.meta.kind} ${d.meta.version} は ${d.meta.effectiveTo} までの制度です。以降の年も同じ内容を仮定しています。`,
      );
    }
    if (d.meta.status !== "verified") {
      warnings.push(`${d.meta.kind} ${d.meta.version} は ${d.meta.status} です。`);
    }
  }
  const selectedLimit = picked.get("contribution-limit");
  return {
    ok: true,
    set: {
      baseDate,
      insurer,
      pension: get<PensionInsurancePayload>("pension-insurance"),
      health: get<HealthInsurancePayload>("health-insurance"),
      incomeTax: get<IncomeTaxPayload>("income-tax"),
      residentTax: get<ResidentTaxPayload>("resident-tax"),
      retirementIncome: get<RetirementIncomePayload>("retirement-income"),
      pensionBenefit: get<PensionBenefitPayload>("pension-benefit"),
      contributionLimit: selectedLimit
        ? {
            payload: get<ContributionLimitPayload>("contribution-limit"),
            version: selectedLimit.meta.version,
            status: selectedLimit.meta.status,
          }
        : null,
      versions: [...picked.values()].map((d) => `${d.meta.kind}:${d.meta.version}`),
      warnings,
    },
  };
}
