import { SimulationInputError, simulate } from "./engine/simulate.ts";
import { ALL_DATASETS } from "./regulations/all-datasets.ts";
import { resolveRegulationSet } from "./regulations/loader.ts";
import { createForm, readForm } from "./ui/form.ts";
import { renderResults } from "./ui/results.ts";
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
  form.querySelector('[name="valuation"]')?.addEventListener("change", () => {
    if (submitted) run();
  });
}
