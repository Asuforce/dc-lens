export type Yen = number;

export type HealthInsurerKind = "kyokai-kenpo" | "kenpo-kumiai" | "custom";

export interface UserProfile {
  age: number;
  retirementAge: number;
  pensionStartAge: number;
  pensionEndAge: number;
  prefecture: string;
  insurer: HealthInsurerKind;
}

export interface SalaryEvent {
  age: number;
  raiseRate: number;
}

export type BonusMode = "fixed-ratio" | "fixed-monthly-bonus-grows";

export interface SalaryProfile {
  annualIncomeYen: Yen;
  monthlySalaryYen: Yen;
  annualBonusYen: Yen;
  annualRaiseRate: number;
  events: SalaryEvent[];
  bonusMode: BonusMode;
  monthlySalaryIsEstimated: boolean;
}

export interface PensionPlan {
  dcMonthlyContributionYen: Yen;
  idecoMonthlyContributionYen: Yen;
  dcAnnualCostRate: number;
  idecoAnnualCostRate: number;
  idecoFixedMonthlyFeeYen: Yen;
  initialBalanceYen: Yen;
}

export interface ProjectionAssumptions {
  grossAnnualReturn: number;
  inflationRate: number;
  discountRate: number;
  mode: "simple" | "detailed";
  valuation: "nominal" | "present-value";
}

export interface SimulationInput {
  profile: UserProfile;
  salary: SalaryProfile;
  plan: PensionPlan;
  assumptions: ProjectionAssumptions;
  regulationVersion: string;
}

export interface CostBreakdown {
  incomeTaxYen: Yen;
  residentTaxYen: Yen;
  socialInsuranceYen: Yen;
  fixedFeeYen: Yen;
  trustFeeYen: Yen;
}

export interface ScenarioYearResult {
  grossPayYen: Yen;
  takeHomeYen: Yen;
  contributionYen: Yen;
  investmentBalanceYen: Yen;
  breakdown: CostBreakdown;
  sources: string[];
}

export interface YearlyResult {
  year: number;
  age: number;
  salaryYen: Yen;
  dc: ScenarioYearResult;
  ideco: ScenarioYearResult;
  annualCashFlowDifferenceYen: Yen;
  investmentBalanceDifferenceYen: Yen;
  annualPensionBenefitDifferenceYen: Yen;
  cumulativeNominalDifferenceYen: Yen;
  cumulativePresentValueDifferenceYen: Yen;
  warnings: string[];
}

export interface SimulationSummary {
  currentAnnualDifferenceYen: Yen;
  retirementAssetDifferenceYen: Yen;
  annualPensionDifferenceAtRetirementYen: Yen;
  breakEvenAge: number | null;
  lifetimeNominalDifferenceYen: Yen;
  lifetimePresentValueDifferenceYen: Yen;
}

export interface SimulationResult {
  yearlyResults: YearlyResult[];
  summary: SimulationSummary;
  regulationVersion: string;
  assumptions: string[];
  warnings: string[];
}
