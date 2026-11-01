import { simulateYear, validateInvestmentParams } from "./investment.ts";

export interface TransferInput {
  balanceYen: number;
  transferFeeYen: number;
  idleMonths: number;
  yearsToRetirement: number;
  grossAnnualReturn: number;
  keep: { annualCostRate: number; fixedMonthlyFeeYen: number };
  move: { annualCostRate: number; fixedMonthlyFeeYen: 0 };
  discountRate: number;
}

export interface TransferResult {
  keepBalanceAtRetirementYen: number;
  moveBalanceAtRetirementYen: number;
  differenceYen: number;
  presentValueDifferenceYen: number;
  warnings: string[];
  assumptions: string[];
}

export function validateTransferInput(input: TransferInput): string[] {
  const errors: string[] = [];
  for (const [label, value] of [
    ["既存資産", input.balanceYen],
    ["移換手数料", input.transferFeeYen],
    ["移換期間", input.idleMonths],
    ["退職までの年数", input.yearsToRetirement],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0)
      errors.push(`${label}は0以上の整数で入力してください。`);
  }
  errors.push(
    ...validateInvestmentParams({ grossAnnualReturn: input.grossAnnualReturn, ...input.keep }),
  );
  errors.push(
    ...validateInvestmentParams({ grossAnnualReturn: input.grossAnnualReturn, ...input.move }),
  );
  if (input.move.fixedMonthlyFeeYen !== 0) errors.push("移換先の固定費は0円である必要があります。");
  if (!Number.isFinite(input.discountRate) || input.discountRate <= -1)
    errors.push("割引率は-100%より大きくしてください。");
  return errors;
}

export function compareTransfer(input: TransferInput): TransferResult {
  const errors = validateTransferInput(input);
  if (errors.length) throw new Error(errors.join(" / "));
  const months = input.yearsToRetirement * 12;
  const keepBalanceAtRetirementYen = simulateYear(
    input.balanceYen,
    0,
    { grossAnnualReturn: input.grossAnnualReturn, ...input.keep },
    months,
  ).endBalanceYen;
  const moveBalanceAtRetirementYen = simulateYear(
    Math.max(0, input.balanceYen - input.transferFeeYen),
    0,
    { grossAnnualReturn: input.grossAnnualReturn, ...input.move },
    Math.max(0, months - input.idleMonths),
  ).endBalanceYen;
  const differenceYen = moveBalanceAtRetirementYen - keepBalanceAtRetirementYen;
  return {
    keepBalanceAtRetirementYen,
    moveBalanceAtRetirementYen,
    differenceYen,
    presentValueDifferenceYen: Math.round(
      differenceYen / (1 + input.discountRate) ** input.yearsToRetirement,
    ),
    warnings: [
      "移換の可否と手数料は勤務先の規約・運営管理機関によります。",
      "新規掛金とは別の判断です。",
      "社会保険料の軽減は計上していません。",
    ],
    assumptions: ["税引前評価額です。移換期間中は運用と手数料を停止します。"],
  };
}
