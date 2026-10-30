import type { RegulationSet } from "../regulations/loader.ts";
import { cumulative, findBreakEvenAge, presentValueYen } from "./comparison.ts";
import { type InvestmentParams, simulateYear, validateInvestmentParams } from "./investment.ts";
import { annualAccrualYen } from "./pension.ts";
import { projectSalary, validateSalaryProfile } from "./salary.ts";
import { annualSocialInsurance, type SocialInsuranceResult } from "./social-insurance.ts";
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
    errors.push("協会けんぽ以外の健康保険者は未対応です。");
  }
  errors.push(...validateSalaryProfile(salary));
  const contributions: [string, number][] = [
    ["選択制DC掛金", plan.dcMonthlyContributionYen],
    ["iDeCo掛金", plan.idecoMonthlyContributionYen],
    ["初期運用資産", plan.initialBalanceYen],
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
      const bonus = splitBonus(y.annualBonusYen);
      const siFor = (monthly: Yen): SocialInsuranceResult =>
        annualSocialInsurance(set, {
          prefecture: profile.prefecture,
          age,
          monthlyRemunerationYen: monthly,
          bonusPaymentsYen: bonus,
        });

      const siDc = siFor(y.monthlySalaryYen - plan.dcMonthlyContributionYen);
      const siIdeco = siFor(y.monthlySalaryYen);
      const dcGross = y.annualGrossYen - dcAnnual;
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
          grossSalaryYen: y.annualGrossYen,
          socialInsuranceYen: siIdeco.totalEmployeeYen,
          smallBusinessMutualAidYen: idecoAnnual,
        },
        set.incomeTax,
      );
      const idecoResident = residentTax(
        {
          grossSalaryYen: y.annualGrossYen,
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
        sources: set.versions,
      };
      idecoResult = {
        grossPayYen: y.annualGrossYen,
        takeHomeYen:
          y.annualGrossYen -
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
        sources: set.versions,
      };
      accrualsDc.push(
        annualAccrualYen(
          set.pensionBenefit,
          siDc.pensionStandardMonthlyYen,
          siDc.pensionStandardBonusYen,
        ),
      );
      accrualsIdeco.push(
        annualAccrualYen(
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
        sources: set.versions,
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
        sources: set.versions,
      };
    }

    for (const w of rowWarnings) warningSet.add(w);
    yearly.push({
      year: baseYear + (age - profile.age),
      age,
      salaryYen: y?.annualGrossYen ?? 0,
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
  if (plan.initialBalanceYen > 0) {
    warnings.push("初期運用資産は比較に含めていません。既存資産の移換は新規掛金とは別の判断です。");
  }
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
    regulationVersion: set.versions.join(" / "),
    assumptions: [...ASSUMPTIONS],
    warnings: [...new Set(warnings)],
  };
}
