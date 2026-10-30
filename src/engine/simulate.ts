import type { RegulationSet } from "../regulations/loader.ts";
import { cumulative, findBreakEvenAge, presentValueYen } from "./comparison.ts";
import { scheduleStandardRemuneration } from "./grade-schedule.ts";
import { type InvestmentParams, simulateYear, validateInvestmentParams } from "./investment.ts";
import { annualAccrualFromMonthlyYen, annualAccrualYen } from "./pension.ts";
import { projectSalary, validateSalaryProfile } from "./salary.ts";
import {
  annualSocialInsurance,
  annualSocialInsuranceMonthly,
  type SocialInsuranceResult,
} from "./social-insurance.ts";
import { incomeTax, residentTax } from "./tax.ts";
import type {
  ScenarioYearResult,
  SimulationInput,
  SimulationResult,
  YearlyResult,
  Yen,
} from "./types.ts";

export const BONUS_PAYMENTS_PER_YEAR = 2;

export class SimulationInputError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join(" / "));
    this.name = "SimulationInputError";
    this.errors = errors;
  }
}

export const ASSUMPTIONS: readonly string[] = [
  "差額はすべて「選択制DC − iDeCo」で表し、正の値は選択制DCが有利であることを示します。",
  "制度は基準日時点の内容で固定し、将来の改正は反映していません。",
  "社会保険の等級は年間を通じて同じとし、随時改定は簡易に即時反映するものとして扱います。",
  `賞与は年${BONUS_PAYMENTS_PER_YEAR}回に均等に支払われるものとし、掛金は月給から拠出します。`,
  "住民税は前年所得課税の時差を考慮せず、同じ年の所得に課すものとして概算します。",
  "老齢厚生年金は報酬比例部分の2003年4月以降の乗率のみで、再評価は現在価値で表すものとして扱います。",
  "運用資産は税引前評価額で、受取時の課税は反映していません。",
  "運用利回りはシナリオ上の仮定で、将来の予測や保証ではありません。",
  "損益分岐年齢は、選択した評価基準の累積差が0を横切る最初の年齢です。",
];
const DETAILED_NOTES = [
  "詳細モード: 定時決定(4〜6月の平均を9月に反映)と随時改定(固定的賃金の変動後3か月の平均で2等級以上の差があれば4か月目から反映)を月単位で扱います。",
  "対象外: 上限・下限等級での1等級差の例外、支払基礎日数17日未満、非固定的賃金の増減のみの変動、短時間労働者の11日基準。賞与は標準報酬月額に含めません。",
  "年初を基準に各暦年を1月から12月として扱い、開始時点の標準報酬月額は昇給・掛金の前の月給の等級とします。昇給月は入力値で、毎年同じ月に昇給するものとします。",
];

export function validateSimulationInput(input: SimulationInput): string[] {
  const errors: string[] = [];
  const { profile, salary, plan, assumptions } = input;
  const ints: [string, number][] = [
    ["年齢", profile.age],
    ["退職年齢", profile.retirementAge],
    ["年金受給開始年齢", profile.pensionStartAge],
    ["受給終了年齢", profile.pensionEndAge],
  ];
  for (const [label, v] of ints) {
    if (!Number.isInteger(v) || v < 0) errors.push(`${label}は0以上の整数で入力してください。`);
  }
  if (profile.retirementAge <= profile.age)
    errors.push("退職年齢は現在の年齢より大きくしてください。");
  if (profile.pensionEndAge <= profile.pensionStartAge) {
    errors.push("受給終了年齢は受給開始年齢より大きくしてください。");
  }
  if (profile.insurer !== "kyokai-kenpo") {
    for (const [label, value, positive] of [
      ["健康保険料率", profile.customHealthRates?.healthTotalRatePercent, true],
      ["介護保険料率", profile.customHealthRates?.careTotalRatePercent, false],
      ["子ども・子育て支援金率", profile.customHealthRates?.childSupportTotalRatePercent, false],
    ] as const) {
      if (
        value === undefined ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 20 ||
        (positive && value === 0)
      )
        errors.push(
          `${label}は${positive ? "0より大きく" : "0以上"}、20以下の数値で入力してください。`,
        );
    }
  }
  errors.push(...validateSalaryProfile(salary));
  if (
    assumptions.mode === "detailed" &&
    salary.raiseMonth !== undefined &&
    (!Number.isInteger(salary.raiseMonth) || salary.raiseMonth < 1 || salary.raiseMonth > 12)
  )
    errors.push("昇給月は1から12の整数で入力してください。");
  const contributions: [string, number][] = [
    ["選択制DC掛金", plan.dcMonthlyContributionYen],
    ["iDeCo掛金", plan.idecoMonthlyContributionYen],
  ];
  for (const [label, v] of contributions) {
    if (!Number.isInteger(v) || v < 0) errors.push(`${label}は0以上の整数円で入力してください。`);
  }
  if (plan.dcMonthlyContributionYen > salary.monthlySalaryYen) {
    errors.push("選択制DC掛金が月給を超えています。");
  }
  errors.push(
    ...validateInvestmentParams({
      grossAnnualReturn: assumptions.grossAnnualReturn,
      annualCostRate: plan.dcAnnualCostRate,
      fixedMonthlyFeeYen: 0,
    }),
    ...validateInvestmentParams({
      grossAnnualReturn: assumptions.grossAnnualReturn,
      annualCostRate: plan.idecoAnnualCostRate,
      fixedMonthlyFeeYen: plan.idecoFixedMonthlyFeeYen,
    }),
  );
  if (!Number.isFinite(assumptions.discountRate) || assumptions.discountRate <= -1) {
    errors.push("割引率は-100%より大きい数値で入力してください。");
  }
  return [...new Set(errors)];
}

function splitBonus(annualBonusYen: Yen): Yen[] {
  const base = Math.floor(annualBonusYen / BONUS_PAYMENTS_PER_YEAR);
  const payments = Array.from({ length: BONUS_PAYMENTS_PER_YEAR }, () => base);
  payments[0] = (payments[0] ?? 0) + (annualBonusYen - base * BONUS_PAYMENTS_PER_YEAR);
  return payments;
}

interface ScenarioState {
  balanceYen: Yen;
}

function emptyBreakdown() {
  return {
    incomeTaxYen: 0,
    residentTaxYen: 0,
    socialInsuranceYen: 0,
    fixedFeeYen: 0,
    trustFeeYen: 0,
  };
}

export function simulate(input: SimulationInput, set: RegulationSet): SimulationResult {
  const errors = validateSimulationInput(input);
  if (errors.length > 0) throw new SimulationInputError(errors);

  const { profile, salary, plan, assumptions } = input;
  const custom = profile.insurer !== "kyokai-kenpo";
  const rates = profile.customHealthRates;
  const effectiveSet =
    custom && rates
      ? {
          ...set,
          health: {
            ...set.health,
            healthTotalRatePercentByPrefecture: { custom: rates.healthTotalRatePercent },
            careTotalRatePercent: rates.careTotalRatePercent,
            childSupportTotalRatePercent: rates.childSupportTotalRatePercent,
          },
        }
      : set;
  const versions = custom
    ? [
        ...set.versions.filter((v) => !v.startsWith("health-insurance:")),
        "健康保険料率: 利用者入力",
      ]
    : set.versions;
  const dcParams: InvestmentParams = {
    grossAnnualReturn: assumptions.grossAnnualReturn,
    annualCostRate: plan.dcAnnualCostRate,
    fixedMonthlyFeeYen: 0,
  };
  const idecoParams: InvestmentParams = {
    grossAnnualReturn: assumptions.grossAnnualReturn,
    annualCostRate: plan.idecoAnnualCostRate,
    fixedMonthlyFeeYen: plan.idecoFixedMonthlyFeeYen,
  };

  const working = projectSalary(profile, salary);
  const detailed = assumptions.mode === "detailed";
  const raiseMonth = salary.raiseMonth ?? 4;
  const monthlySalary = working.flatMap((year, k) =>
    Array.from({ length: 12 }, (_, month) =>
      k > 0 && month < raiseMonth - 1
        ? (working[k - 1]?.monthlySalaryYen ?? year.monthlySalaryYen)
        : year.monthlySalaryYen,
    ),
  );
  if (detailed && monthlySalary.some((value) => value < plan.dcMonthlyContributionYen)) {
    throw new SimulationInputError(["選択制DC掛金が将来の月給を超えています。"]);
  }
  const changes = working.flatMap((_, k) => (k === 0 ? [] : [k * 12 + raiseMonth - 1]));
  const standards = (contribution: number) => {
    const monthlyRemunerationYen = monthlySalary.map((value) => value - contribution);
    const fixedWageChangeMonthIndexes = contribution > 0 ? [0, ...changes] : changes;
    const args = {
      initialRemunerationYen: salary.monthlySalaryYen,
      monthlyRemunerationYen,
      fixedWageChangeMonthIndexes,
    };
    return {
      pension: scheduleStandardRemuneration({ ...args, table: effectiveSet.pension }),
      health: scheduleStandardRemuneration({ ...args, table: effectiveSet.health }),
    };
  };
  const dcStandards = detailed ? standards(plan.dcMonthlyContributionYen) : undefined;
  const idecoStandards = detailed ? standards(0) : undefined;
  const lastAge = Math.max(profile.pensionEndAge, profile.retirementAge) - 1;
  const dc: ScenarioState = { balanceYen: 0 };
  const ideco: ScenarioState = { balanceYen: 0 };
  const dcAnnual = 12 * plan.dcMonthlyContributionYen;
  const idecoAnnual = 12 * plan.idecoMonthlyContributionYen;

  const accrualsDc: Yen[] = [];
  const accrualsIdeco: Yen[] = [];
  const yearly: YearlyResult[] = [];
  const warningSet = new Set<string>();
  const baseYear = new Date(set.baseDate).getUTCFullYear();

  for (let age = profile.age; age <= lastAge; age += 1) {
    const y = working.find((w) => w.age === age);
    const rowWarnings = new Set<string>();
    let dcResult: ScenarioYearResult;
    let idecoResult: ScenarioYearResult;

    if (y) {
      const index = age - profile.age;
      const slice = (s: { pension: number[]; health: number[] }) => ({
        pension: s.pension.slice(index * 12, index * 12 + 12),
        health: s.health.slice(index * 12, index * 12 + 12),
      });
      const dcMonthly = dcStandards && slice(dcStandards);
      const idecoMonthly = idecoStandards && slice(idecoStandards);
      const gross = detailed
        ? monthlySalary.slice(index * 12, index * 12 + 12).reduce((a, b) => a + b, 0) +
          y.annualBonusYen
        : y.annualGrossYen;
      const bonus = splitBonus(y.annualBonusYen);
      const siFor = (
        monthly: Yen,
        standardsForYear?: { pension: number[]; health: number[] },
      ): SocialInsuranceResult =>
        standardsForYear
          ? annualSocialInsuranceMonthly(effectiveSet, {
              prefecture: custom ? "custom" : profile.prefecture,
              age,
              pensionStandardMonthlyYen: standardsForYear.pension,
              healthStandardMonthlyYen: standardsForYear.health,
              bonusPaymentsYen: bonus,
            })
          : annualSocialInsurance(effectiveSet, {
              prefecture: custom ? "custom" : profile.prefecture,
              age,
              monthlyRemunerationYen: monthly,
              bonusPaymentsYen: bonus,
            });

      const siDc = siFor(y.monthlySalaryYen - plan.dcMonthlyContributionYen, dcMonthly);
      const siIdeco = siFor(y.monthlySalaryYen, idecoMonthly);
      const dcGross = gross - dcAnnual;
      const dcIncome = incomeTax(
        {
          grossSalaryYen: dcGross,
          socialInsuranceYen: siDc.totalEmployeeYen,
          smallBusinessMutualAidYen: 0,
        },
        set.incomeTax,
      );
      const dcResident = residentTax(
        {
          grossSalaryYen: dcGross,
          socialInsuranceYen: siDc.totalEmployeeYen,
          smallBusinessMutualAidYen: 0,
        },
        set.residentTax,
      );
      const idecoIncome = incomeTax(
        {
          grossSalaryYen: gross,
          socialInsuranceYen: siIdeco.totalEmployeeYen,
          smallBusinessMutualAidYen: idecoAnnual,
        },
        set.incomeTax,
      );
      const idecoResident = residentTax(
        {
          grossSalaryYen: gross,
          socialInsuranceYen: siIdeco.totalEmployeeYen,
          smallBusinessMutualAidYen: idecoAnnual,
        },
        set.residentTax,
      );

      const dcFlow = simulateYear(dc.balanceYen, plan.dcMonthlyContributionYen, dcParams);
      const idecoFlow = simulateYear(
        ideco.balanceYen,
        plan.idecoMonthlyContributionYen,
        idecoParams,
      );
      dc.balanceYen = dcFlow.endBalanceYen;
      ideco.balanceYen = idecoFlow.endBalanceYen;

      for (const w of [
        ...siDc.warnings,
        ...siIdeco.warnings,
        ...dcIncome.warnings,
        ...dcResident.warnings,
        ...idecoIncome.warnings,
        ...idecoResident.warnings,
      ]) {
        rowWarnings.add(w);
      }

      dcResult = {
        grossPayYen: dcGross,
        takeHomeYen: dcGross - siDc.totalEmployeeYen - dcIncome.totalYen - dcResident.totalYen,
        contributionYen: dcAnnual,
        investmentBalanceYen: dc.balanceYen,
        breakdown: {
          incomeTaxYen: dcIncome.totalYen,
          residentTaxYen: dcResident.totalYen,
          socialInsuranceYen: siDc.totalEmployeeYen,
          fixedFeeYen: dcFlow.fixedFeeYen,
          trustFeeYen: dcFlow.trustFeeYen,
        },
        sources: versions,
        ...(dcMonthly ? { monthlyStandardRemuneration: dcMonthly } : {}),
      };
      idecoResult = {
        grossPayYen: gross,
        takeHomeYen:
          gross -
          siIdeco.totalEmployeeYen -
          idecoIncome.totalYen -
          idecoResident.totalYen -
          idecoAnnual,
        contributionYen: idecoAnnual,
        investmentBalanceYen: ideco.balanceYen,
        breakdown: {
          incomeTaxYen: idecoIncome.totalYen,
          residentTaxYen: idecoResident.totalYen,
          socialInsuranceYen: siIdeco.totalEmployeeYen,
          fixedFeeYen: idecoFlow.fixedFeeYen,
          trustFeeYen: idecoFlow.trustFeeYen,
        },
        sources: versions,
        ...(idecoMonthly ? { monthlyStandardRemuneration: idecoMonthly } : {}),
      };
      accrualsDc.push(
        dcMonthly
          ? annualAccrualFromMonthlyYen(
              set.pensionBenefit,
              dcMonthly.pension,
              siDc.pensionStandardBonusYen,
            )
          : annualAccrualYen(
              set.pensionBenefit,
              siDc.pensionStandardMonthlyYen,
              siDc.pensionStandardBonusYen,
            ),
      );
      accrualsIdeco.push(
        idecoMonthly
          ? annualAccrualFromMonthlyYen(
              set.pensionBenefit,
              idecoMonthly.pension,
              siIdeco.pensionStandardBonusYen,
            )
          : annualAccrualYen(
              set.pensionBenefit,
              siIdeco.pensionStandardMonthlyYen,
              siIdeco.pensionStandardBonusYen,
            ),
      );
    } else {
      const dcFlow = simulateYear(dc.balanceYen, 0, dcParams);
      const idecoFlow = simulateYear(ideco.balanceYen, 0, idecoParams);
      dc.balanceYen = dcFlow.endBalanceYen;
      ideco.balanceYen = idecoFlow.endBalanceYen;
      dcResult = {
        grossPayYen: 0,
        takeHomeYen: 0,
        contributionYen: 0,
        investmentBalanceYen: dc.balanceYen,
        breakdown: {
          ...emptyBreakdown(),
          fixedFeeYen: dcFlow.fixedFeeYen,
          trustFeeYen: dcFlow.trustFeeYen,
        },
        sources: versions,
      };
      idecoResult = {
        grossPayYen: 0,
        takeHomeYen: 0,
        contributionYen: 0,
        investmentBalanceYen: ideco.balanceYen,
        breakdown: {
          ...emptyBreakdown(),
          fixedFeeYen: idecoFlow.fixedFeeYen,
          trustFeeYen: idecoFlow.trustFeeYen,
        },
        sources: versions,
      };
    }

    for (const w of rowWarnings) warningSet.add(w);
    yearly.push({
      year: baseYear + (age - profile.age),
      age,
      salaryYen: y ? (detailed ? dcResult.grossPayYen + dcAnnual : y.annualGrossYen) : 0,
      dc: dcResult,
      ideco: idecoResult,
      annualCashFlowDifferenceYen: dcResult.takeHomeYen - idecoResult.takeHomeYen,
      investmentBalanceDifferenceYen: dc.balanceYen - ideco.balanceYen,
      annualPensionBenefitDifferenceYen: 0,
      cumulativeNominalDifferenceYen: 0,
      cumulativePresentValueDifferenceYen: 0,
      warnings: [...rowWarnings],
    });
  }

  const annualBenefitDc = accrualsDc.reduce((s, a) => s + a, 0);
  const annualBenefitIdeco = accrualsIdeco.reduce((s, a) => s + a, 0);
  const annualBenefitDifference = annualBenefitDc - annualBenefitIdeco;
  const lastWorkingIndex = yearly.findLastIndex((r) => r.age < profile.retirementAge);
  const retirementAssetDifference = yearly[lastWorkingIndex]?.investmentBalanceDifferenceYen ?? 0;

  const nominalIncrements: Yen[] = [];
  const pvIncrements: Yen[] = [];
  yearly.forEach((row, i) => {
    const inPension = row.age >= profile.pensionStartAge && row.age < profile.pensionEndAge;
    row.annualPensionBenefitDifferenceYen = inPension ? annualBenefitDifference : 0;
    const t = row.age - profile.age;
    let nominal = row.annualCashFlowDifferenceYen + row.annualPensionBenefitDifferenceYen;
    let pv = presentValueYen(nominal, assumptions.discountRate, t);
    if (i === lastWorkingIndex) {
      nominal += retirementAssetDifference;
      pv += presentValueYen(
        retirementAssetDifference,
        assumptions.discountRate,
        profile.retirementAge - profile.age,
      );
    }
    nominalIncrements.push(nominal);
    pvIncrements.push(pv);
  });
  const cumNominal = cumulative(nominalIncrements);
  const cumPv = cumulative(pvIncrements);
  yearly.forEach((row, i) => {
    row.cumulativeNominalDifferenceYen = cumNominal[i] ?? 0;
    row.cumulativePresentValueDifferenceYen = cumPv[i] ?? 0;
  });

  const warnings = [...set.warnings];
  if (detailed) warnings.push(...DETAILED_NOTES);
  if (custom)
    warnings.push(
      "健康保険料率は利用者入力の値です。等級表と賞与上限は法定の共通表を使っています。",
    );
  if (set.contributionLimit) {
    for (const [name, amount, cap] of [
      ["選択制DC", plan.dcMonthlyContributionYen, set.contributionLimit.payload.dcMonthlyYen],
      ["iDeCo", plan.idecoMonthlyContributionYen, set.contributionLimit.payload.idecoMonthlyYen],
    ] as const) {
      if (amount > cap)
        warnings.push(
          `${name}の月額掛金${amount}円は上限${cap}円を超えています。他制度への加入がない場合の上限です。`,
        );
    }
  }
  warnings.push(
    set.contributionLimit
      ? "加入資格と他制度の掛金は確認していません。"
      : "拠出限度額と加入資格は確認していません。勤務先の規程と制度の上限を別途確認してください。",
    "インフレ率は計算に使用していません。現在価値は割引率のみで求めます。",
    "老齢厚生年金以外の給付(障害・遺族)や健康保険の給付への影響は対象外です。",
  );
  for (const w of warningSet) warnings.push(w);

  const series = assumptions.valuation === "present-value" ? cumPv : cumNominal;
  return {
    yearlyResults: yearly,
    summary: {
      currentAnnualDifferenceYen: yearly[0]?.annualCashFlowDifferenceYen ?? 0,
      retirementAssetDifferenceYen: retirementAssetDifference,
      annualPensionDifferenceAtRetirementYen: annualBenefitDifference,
      breakEvenAge: findBreakEvenAge(
        yearly.map((r) => r.age),
        series,
      ),
      lifetimeNominalDifferenceYen: cumNominal.at(-1) ?? 0,
      lifetimePresentValueDifferenceYen: cumPv.at(-1) ?? 0,
    },
    regulationVersion: versions.join(" / "),
    assumptions: [
      ...(detailed
        ? [...ASSUMPTIONS.slice(0, 2), ...DETAILED_NOTES, ...ASSUMPTIONS.slice(3)]
        : ASSUMPTIONS),
      ...(custom
        ? [
            "健康保険料率は利用者入力の労使合計を折半します。事業主負担が大きい場合は本人料率の2倍を入力します。",
          ]
        : []),
    ],
    warnings: [...new Set(warnings)],
  };
}
