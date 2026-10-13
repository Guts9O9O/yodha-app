// Regenerate the plan-file JSON Schema in docs/import-schema/ (npm run import-schema).
// Run it after changing src/schemas/import/*; a test fails if the committed files are stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { importJsonSchemas } from "../src/schemas/import/json-schema.js";

const outDir = new URL("../docs/import-schema/", import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const [file, schema] of Object.entries(importJsonSchemas())) {
  writeFileSync(new URL(file, outDir), `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`docs/import-schema/${file}`);
}
