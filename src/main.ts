import { afterTaxPayout } from "./engine/payout-tax.ts";
import { SimulationInputError, simulate } from "./engine/simulate.ts";
import { compareTransfer } from "./engine/transfer.ts";
import { ALL_DATASETS } from "./regulations/all-datasets.ts";
import { resolveRegulationSet } from "./regulations/loader.ts";
import { createForm, readForm } from "./ui/form.ts";
import { renderPayout, renderResults, renderTransfer } from "./ui/results.ts";
import {
  addScenario,
  removeScenario,
  renderScenarioTable,
  type ScenarioEntry,
} from "./ui/scenarios.ts";
import { parseForm } from "./ui/state.ts";

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found;
}
element("build-version").textContent = __APP_VERSION__;
element("build-sha").textContent = __GIT_SHA__;
const resolved = resolveRegulationSet(
  ALL_DATASETS,
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }),
  "precise",
);
const errors = element("errors");
const output = element("output");
if (!resolved.ok) {
  errors.textContent = `未対応: ${resolved.errors.join(" / ")}`;
} else {
  const set = resolved.set;
  const form = createForm(Object.keys(set.health.healthTotalRatePercentByPrefecture));
  element("form-container").append(form);
  let scenarios: ScenarioEntry[] = [];
  let nextId = 1;
  const comparison = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = "シナリオ比較";
  const status = document.createElement("p");
  status.setAttribute("aria-live", "polite");
  const tableContainer = document.createElement("div");
  comparison.append(heading, status, tableContainer);
  output.after(comparison);
  const renderComparison = () => {
    tableContainer.replaceChildren(
      renderScenarioTable(scenarios, (id) => {
        scenarios = removeScenario(scenarios, id);
        status.textContent = "シナリオを削除しました。";
        renderComparison();
      }),
    );
  };
  renderComparison();
  let submitted = false;
  const run = () => {
    submitted = false;
    output.replaceChildren();
    errors.textContent = "";
    const parsed = parseForm(readForm(form, set.versions.join(" / ")));
    if (!parsed.ok) {
      errors.textContent = parsed.errors.join(" / ");
      errors.focus();
      return;
    }
    try {
      const result = simulate(parsed.input, set);
      output.append(
        renderResults(
          result,
          ALL_DATASETS,
          parsed.input.salary.monthlySalaryIsEstimated,
          parsed.input.assumptions.valuation,
        ),
      );
      if (parsed.transfer) output.append(renderTransfer(compareTransfer(parsed.transfer)));
      if (parsed.payout)
        output.append(
          renderPayout(afterTaxPayout(result, parsed.input, parsed.payout.priorServiceYears, set)),
        );
      const label = document.createElement("label");
      label.textContent = "シナリオ名";
      const input = document.createElement("input");
      input.maxLength = 40;
      label.append(input);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "このシナリオを比較に追加";
      button.addEventListener("click", () => {
        if (scenarios.length >= 4) {
          status.textContent = "比較できるシナリオは4件までです。";
          return;
        }
        scenarios = addScenario(scenarios, {
          id: nextId++,
          label: input.value,
          valuation: parsed.input.assumptions.valuation,
          regulationVersion: result.regulationVersion,
          summary: result.summary,
          contributions: {
            dcMonthlyYen: parsed.input.plan.dcMonthlyContributionYen,
            idecoMonthlyYen: parsed.input.plan.idecoMonthlyContributionYen,
          },
          grossAnnualReturn: parsed.input.assumptions.grossAnnualReturn,
        });
        status.textContent = "シナリオを追加しました。";
        renderComparison();
      });
      const download = output.querySelector("button");
      download?.after(label, button);
      submitted = true;
    } catch (e) {
      if (e instanceof SimulationInputError) {
        errors.textContent = e.errors.join(" / ");
        errors.focus();
      } else throw e;
    }
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  form.querySelector('[name="transferEnabled"]')?.addEventListener("change", () => {
    if (!form.querySelector<HTMLInputElement>('[name="transferEnabled"]')?.checked)
      output.querySelector("#transfer-result")?.remove();
  });
  form.querySelector('[name="payoutEnabled"]')?.addEventListener("change", () => {
    if (!form.querySelector<HTMLInputElement>('[name="payoutEnabled"]')?.checked)
      output.querySelector("#payout-result")?.remove();
  });
  form.querySelector('[name="valuation"]')?.addEventListener("change", () => {
    if (submitted) run();
  });
}
