import type { Dataset } from "./schema.ts";
import { validateDataset } from "./schema.ts";

const modules = import.meta.glob("./data/**/*.json", { eager: true, import: "default" });

export const ALL_DATASETS: Dataset[] = Object.entries(modules).map(([path, raw]) => {
  const r = validateDataset(raw);
  if (!r.ok) throw new Error(`${path}: ${r.errors.join("; ")}`);
  return r.value;
});
