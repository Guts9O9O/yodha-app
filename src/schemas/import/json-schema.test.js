import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importJsonSchemas } from "./json-schema.js";

describe("docs/import-schema (JSON Schema for plan authors)", () => {
  const generated = importJsonSchemas();

  it.each(Object.keys(generated))(
    "%s is up to date (run `npm run import-schema`)",
    (file) => {
      const committed = JSON.parse(
        readFileSync(`docs/import-schema/${file}`, "utf8"),
      );
      expect(committed).toEqual(generated[file]);
    },
  );

  it("rejects unknown keys and marks the required top-level fields", () => {
    const training = generated["training-v1.schema.json"];
    expect(training.additionalProperties).toBe(false);
    expect(training.required).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "kind",
        "title",
        "startDate",
        "endDate",
        "athletes",
        "sessions",
      ]),
    );
  });
});
