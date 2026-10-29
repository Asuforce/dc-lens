import type { Page } from "@playwright/test";
export async function fill(page: Page) {
  for (const [name, value] of Object.entries({
    age: "35",
    retirementAge: "60",
    pensionStartAge: "65",
    pensionEndAge: "90",
    annualIncome: "4200000",
    monthlySalary: "300000",
    bonus: "600000",
    raiseRate: "1",
    dcContribution: "20000",
    idecoContribution: "20000",
    dcCost: "0.3",
    idecoCost: "0.3",
    fixedFee: "0",
    initialBalance: "0",
    grossReturn: "3",
    inflation: "1",
    discount: "2",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="prefecture"]').selectOption("tokyo");
}
