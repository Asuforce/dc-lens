import { type TransferInput, validateTransferInput } from "../engine/transfer.ts";
import type { SimulationInput } from "../engine/types.ts";

export interface FormValues {
  age: string;
  retirementAge: string;
  pensionStartAge: string;
  pensionEndAge: string;
  annualIncome: string;
  monthlySalary: string;
  bonus: string;
  raiseRate: string;
  events: { age: string; rate: string }[];
  bonusMode: string;
  prefecture: string;
  insurer?: string;
  healthTotalRatePercent?: string;
  careTotalRatePercent?: string;
  childSupportTotalRatePercent?: string;
  dcContribution: string;
  idecoContribution: string;
  dcCost: string;
  idecoCost: string;
  fixedFee: string;
  transferEnabled?: boolean;
  payoutEnabled?: boolean;
  priorServiceYears?: string;
  transferBalance?: string;
  transferFee?: string;
  idleMonths?: string;
  grossReturn: string;
  inflation: string;
  discount: string;
  valuation: string;
  regulationVersion: string;
}
export function parseForm(v: FormValues):
  | {
      ok: true;
      input: SimulationInput;
      transfer?: TransferInput;
      payout?: { priorServiceYears: number };
    }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const n = (value: string, label: string): number => {
    if (value.trim() === "" || !Number.isFinite(Number(value))) {
      errors.push(`${label}を入力してください。`);
      return NaN;
    }
    return Number(value);
  };
  const annual = n(v.annualIncome, "年収"),
    bonus = n(v.bonus, "賞与");
  const estimated = v.monthlySalary.trim() === "";
  const monthly = estimated ? (annual - bonus) / 12 : n(v.monthlySalary, "月給");
  if (
    Number.isFinite(annual) &&
    Number.isFinite(monthly) &&
    Number.isFinite(bonus) &&
    (annual !== 12 * monthly + bonus || !Number.isInteger(monthly))
  )
    errors.push(
      "年収は月給の12か月分と賞与の合計にしてください。推定月給は整数円である必要があります。",
    );
  const insurer =
    v.insurer === "kenpo-kumiai" || v.insurer === "custom" ? v.insurer : "kyokai-kenpo";
  if (insurer === "kyokai-kenpo" && !v.prefecture) errors.push("都道府県を選択してください。");
  const input: SimulationInput = {
    profile: {
      age: n(v.age, "年齢"),
      retirementAge: n(v.retirementAge, "退職年齢"),
      pensionStartAge: n(v.pensionStartAge, "年金受給開始年齢"),
      pensionEndAge: n(v.pensionEndAge, "受給終了年齢"),
      prefecture: v.prefecture,
      insurer,
      ...(insurer !== "kyokai-kenpo"
        ? {
            customHealthRates: {
              healthTotalRatePercent: n(v.healthTotalRatePercent ?? "", "健康保険料率"),
              careTotalRatePercent: n(v.careTotalRatePercent ?? "", "介護保険料率"),
              childSupportTotalRatePercent: n(
                v.childSupportTotalRatePercent ?? "",
                "子ども・子育て支援金率",
              ),
            },
          }
        : {}),
    },
    salary: {
      annualIncomeYen: annual,
      monthlySalaryYen: monthly,
      annualBonusYen: bonus,
      annualRaiseRate: n(v.raiseRate, "昇給率") / 100,
      events: v.events.map((e) => ({
        age: n(e.age, "昇給イベントの年齢"),
        raiseRate: n(e.rate, "昇給イベントの昇給率") / 100,
      })),
      bonusMode:
        v.bonusMode === "fixed-monthly-bonus-grows" ? "fixed-monthly-bonus-grows" : "fixed-ratio",
      monthlySalaryIsEstimated: estimated,
    },
    plan: {
      dcMonthlyContributionYen: n(v.dcContribution, "選択制DC掛金"),
      idecoMonthlyContributionYen: n(v.idecoContribution, "iDeCo掛金"),
      dcAnnualCostRate: n(v.dcCost, "DC年率コスト") / 100,
      idecoAnnualCostRate: n(v.idecoCost, "iDeCo年率コスト") / 100,
      idecoFixedMonthlyFeeYen: n(v.fixedFee, "iDeCo固定費"),
    },
    assumptions: {
      grossAnnualReturn: n(v.grossReturn, "想定利回り") / 100,
      inflationRate: n(v.inflation, "インフレ率") / 100,
      discountRate: n(v.discount, "割引率") / 100,
      mode: "simple",
      valuation: v.valuation === "present-value" ? "present-value" : "nominal",
    },
    regulationVersion: v.regulationVersion,
  };
  const transfer: TransferInput | undefined = v.transferEnabled
    ? {
        balanceYen: n(v.transferBalance ?? "", "移換する既存資産"),
        transferFeeYen: n(v.transferFee ?? "", "移換手数料"),
        idleMonths: n(v.idleMonths ?? "", "移換期間"),
        yearsToRetirement: input.profile.retirementAge - input.profile.age,
        grossAnnualReturn: input.assumptions.grossAnnualReturn,
        keep: {
          annualCostRate: input.plan.idecoAnnualCostRate,
          fixedMonthlyFeeYen: input.plan.idecoFixedMonthlyFeeYen,
        },
        move: { annualCostRate: input.plan.dcAnnualCostRate, fixedMonthlyFeeYen: 0 },
        discountRate: input.assumptions.discountRate,
      }
    : undefined;
  if (transfer) errors.push(...validateTransferInput(transfer));
  const payout = v.payoutEnabled
    ? { priorServiceYears: v.priorServiceYears?.trim() ? Number(v.priorServiceYears) : 0 }
    : undefined;
  if (payout && (!Number.isSafeInteger(payout.priorServiceYears) || payout.priorServiceYears < 0))
    errors.push("すでに拠出した年数は0以上の整数で入力してください。");
  return errors.length
    ? { ok: false, errors }
    : { ok: true, input, ...(transfer ? { transfer } : {}), ...(payout ? { payout } : {}) };
}
