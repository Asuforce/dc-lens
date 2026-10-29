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
  dcContribution: string;
  idecoContribution: string;
  dcCost: string;
  idecoCost: string;
  fixedFee: string;
  initialBalance: string;
  grossReturn: string;
  inflation: string;
  discount: string;
  valuation: string;
  regulationVersion: string;
}
export function parseForm(
  v: FormValues,
): { ok: true; input: SimulationInput } | { ok: false; errors: string[] } {
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
  if (!v.prefecture) errors.push("都道府県を選択してください。");
  const input: SimulationInput = {
    profile: {
      age: n(v.age, "年齢"),
      retirementAge: n(v.retirementAge, "退職年齢"),
      pensionStartAge: n(v.pensionStartAge, "年金受給開始年齢"),
      pensionEndAge: n(v.pensionEndAge, "受給終了年齢"),
      prefecture: v.prefecture,
      insurer: "kyokai-kenpo",
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
      initialBalanceYen: n(v.initialBalance, "初期運用資産"),
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
  return errors.length ? { ok: false, errors } : { ok: true, input };
}
