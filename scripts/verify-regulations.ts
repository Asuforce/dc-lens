import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateDataset } from "../src/regulations/schema.ts";

function listJson(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listJson(path) : path.endsWith(".json") ? [path] : [];
  });
}

const root = "src/regulations/data";
const files = listJson(root);
let failed = 0;

for (const file of files) {
  const result = validateDataset(JSON.parse(readFileSync(file, "utf8")));
  if (!result.ok) {
    failed += 1;
    console.error(`${file}\n  ${result.errors.join("\n  ")}`);
  }
}

console.log(`${files.length} dataset(s) checked, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
