import * as z from "zod";
import { nutritionPlanV1 } from "./nutrition-v1.js";
import { trainingPlanV1 } from "./training-v1.js";

// JSON Schema for people and tools that write plan files outside the app
// (docs/IMPORT_FORMAT.md §9). Generated from the validators so the two can't drift; the
// committed copies in docs/import-schema/ are checked by a test.

const NOTE =
  "Structure only. Rules that compare fields (dates inside the plan, athletes and foods referenced " +
  "consistently, gramsPerUnit by unit, unique keys) and checks that need the app's data (diet rules, " +
  "station keys, costs) are applied by the app's import preview. Full spec: docs/IMPORT_FORMAT.md.";

const PLANS = [
  ["training", trainingPlanV1, "Yoddha Prep training plan (schemaVersion 1)"],
  [
    "nutrition",
    nutritionPlanV1,
    "Yoddha Prep nutrition plan (schemaVersion 1)",
  ],
];

/** @returns {Record<string, object>} file name → JSON Schema */
export function importJsonSchemas() {
  return Object.fromEntries(
    PLANS.map(([kind, schema, title]) => {
      // "input": describe what authors write (before defaults and normalization).
      const json = z.toJSONSchema(schema, {
        io: "input",
        target: "draft-2020-12",
        unrepresentable: "any",
      });
      return [`${kind}-v1.schema.json`, { title, description: NOTE, ...json }];
    }),
  );
}
