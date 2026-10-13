import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nutritionPlanV1 } from "./nutrition-v1.js";
import { trainingPlanV1 } from "./training-v1.js";

// The §8 examples in docs/IMPORT_FORMAT.md are test fixtures: they're read from the doc itself,
// so the spec and the validator can't drift apart. The owner's real pilot plans must pass too.

const spec = readFileSync("docs/IMPORT_FORMAT.md", "utf8");

/** The first ```json block after a heading. */
function exampleAfter(heading) {
  const start = spec.indexOf(heading);
  const block = spec.slice(start).match(/```json\n([\s\S]*?)\n```/);
  if (start < 0 || !block)
    throw new Error(`No JSON example after "${heading}"`);
  return JSON.parse(block[1]);
}

const trainingExample = () =>
  exampleAfter("### 8.1 Minimal valid training plan");
const nutritionExample = () =>
  exampleAfter("### 8.2 Minimal valid nutrition plan");

/** Readable "path: message" lines, e.g. "sessions.0.date: …". */
function problems(schema, input) {
  const result = schema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

const PILOT_DIR = "data/plans/pilot";
const pilotFiles = readdirSync(PILOT_DIR).filter((f) => f.endsWith(".json"));

describe("IMPORT_FORMAT.md §8 examples", () => {
  it("8.1 training example is valid", () => {
    expect(problems(trainingPlanV1, trainingExample())).toEqual([]);
  });

  it("8.2 nutrition example is valid and normalizes optional values", () => {
    expect(problems(nutritionPlanV1, nutritionExample())).toEqual([]);
    const plan = nutritionPlanV1.parse(nutritionExample());
    expect(plan.status).toBe("draft");
    expect(plan.foods[0].per100g.fibreG).toBeNull();
    expect(plan.prices).toEqual([]);
  });

  it("8.3 fragment is a valid session of a team plan", () => {
    const session = exampleAfter("### 8.3 Fragment");
    const plan = {
      ...trainingExample(),
      startDate: "2026-10-14",
      endDate: "2026-10-15",
      athletes: ["chinmay", "aryan"],
      sessions: [session],
    };
    expect(problems(trainingPlanV1, plan)).toEqual([]);
  });
});

describe("real pilot plans in data/plans/pilot", () => {
  it("are all present", () => {
    expect(pilotFiles).toHaveLength(3);
  });

  it.each(pilotFiles)("%s passes the structural schema", (file) => {
    const json = JSON.parse(readFileSync(`${PILOT_DIR}/${file}`, "utf8"));
    const schema = json.kind === "training" ? trainingPlanV1 : nutritionPlanV1;
    expect(problems(schema, json)).toEqual([]);
  });
});

describe("excludeFromBudget (Price)", () => {
  const withPrice = (price) => ({
    ...nutritionExample(),
    prices: [
      {
        foodKey: "example_food",
        priceInr: 100,
        perQty: 1,
        unit: "kg",
        asOf: "2026-10-13",
        source: "EXAMPLE",
        isEstimate: true,
        ...price,
      },
    ],
  });

  it("defaults to false when omitted or null", () => {
    expect(
      nutritionPlanV1.parse(withPrice({})).prices[0].excludeFromBudget,
    ).toBe(false);
    expect(
      nutritionPlanV1.parse(withPrice({ excludeFromBudget: null })).prices[0]
        .excludeFromBudget,
    ).toBe(false);
  });

  it("keeps true", () => {
    expect(
      nutritionPlanV1.parse(withPrice({ excludeFromBudget: true })).prices[0]
        .excludeFromBudget,
    ).toBe(true);
  });

  it("rejects non-booleans", () => {
    expect(
      problems(nutritionPlanV1, withPrice({ excludeFromBudget: "yes" })),
    ).toEqual([expect.stringMatching(/^prices\.0\.excludeFromBudget:/)]);
  });

  it("is set on both pilot protein powders", () => {
    const keys = pilotFiles
      .map((f) => JSON.parse(readFileSync(`${PILOT_DIR}/${f}`, "utf8")))
      .filter((j) => j.kind === "nutrition")
      .flatMap((j) => nutritionPlanV1.parse(j).prices)
      .filter((p) => p.excludeFromBudget)
      .map((p) => p.foodKey)
      .sort();
    expect(keys).toEqual(["whey_protein", "yeast_protein_powder"]);
  });
});

describe("training rules", () => {
  const withSession = (patch) => {
    const plan = trainingExample();
    plan.sessions[0] = { ...plan.sessions[0], ...patch };
    return plan;
  };
  const withExercise = (patch) => {
    const plan = trainingExample();
    Object.assign(plan.sessions[0].blocks[0].exercises[0], patch);
    return plan;
  };

  it("rejects unknown keys by name (typos are caught, not ignored)", () => {
    expect(
      problems(trainingPlanV1, withExercise({ distanceMeters: 3000 })).join(
        "\n",
      ),
    ).toMatch(/distanceMeters/);
  });

  it("rejects dates outside the plan and impossible dates", () => {
    expect(
      problems(trainingPlanV1, withSession({ date: "2026-10-20" })),
    ).toEqual(["sessions.0.date: 2026-10-20 is outside 2026-10-14–2026-10-14"]);
    expect(
      problems(trainingPlanV1, withSession({ date: "2026-02-30" })).join(),
    ).toMatch(/real date/);
  });

  it("rejects an end date before the start", () => {
    const plan = { ...trainingExample(), endDate: "2026-10-13" };
    expect(problems(trainingPlanV1, plan).join()).toMatch(
      /endDate: must be on or after startDate/,
    );
  });

  it("requires 2+ athletes for a joint session and plan athletes in sessions", () => {
    expect(
      problems(trainingPlanV1, withSession({ joint: true })).join(),
    ).toMatch(/joint session needs at least 2/);
    expect(
      problems(trainingPlanV1, withSession({ athletes: ["aryan"] })).join(),
    ).toMatch(/isn't in the plan's athletes/);
  });

  it("lets only rest sessions omit blocks", () => {
    expect(
      problems(trainingPlanV1, withSession({ blocks: [] })).join(),
    ).toMatch(/at least one block/);
    expect(
      problems(
        trainingPlanV1,
        withSession({ type: "rest", blocks: undefined }),
      ),
    ).toEqual([]);
  });

  it("checks per-athlete overrides", () => {
    expect(
      problems(
        trainingPlanV1,
        withExercise({ perAthlete: { aryan: { sets: 2 } } }),
      ).join(),
    ).toMatch(/"aryan" isn't one of this session's athletes/);
    expect(
      problems(
        trainingPlanV1,
        withExercise({ perAthlete: { chinmay: {} } }),
      ).join(),
    ).toMatch(/needs at least one field/);
  });

  it("keeps stationKey consistent with category and RPE in range", () => {
    expect(
      problems(trainingPlanV1, withExercise({ stationKey: "row" })).join(),
    ).toMatch(/must equal category/);
    expect(
      problems(trainingPlanV1, withExercise({ targetRpe: "8-6" })).join(),
    ).toMatch(/low before high/);
    expect(
      problems(trainingPlanV1, withExercise({ targetRpe: "11" })).join(),
    ).toMatch(/between 1 and 10/);
  });

  it("treats blank optional text as null and rejects blank required text", () => {
    const plan = trainingPlanV1.parse(
      withSession({ objective: "   ", lighterOption: "" }),
    );
    expect(plan.sessions[0].objective).toBeNull();
    expect(plan.sessions[0].lighterOption).toBeNull();
    expect(
      problems(trainingPlanV1, withSession({ title: "  " })).join(),
    ).toMatch(/title: can't be empty/);
  });

  it("supports only schemaVersion 1", () => {
    expect(
      problems(trainingPlanV1, {
        ...trainingExample(),
        schemaVersion: 2,
      }).join(),
    ).toMatch(/schemaVersion must be 1/);
  });
});

describe("nutrition rules", () => {
  it("rejects zero placeholders where zero makes no sense", () => {
    const plan = { ...nutritionExample(), targets: { kcal: [0, 0] } };
    expect(problems(nutritionPlanV1, plan).join()).toMatch(/targets\.kcal/);
    const zeroGrams = nutritionExample();
    zeroGrams.days[0].meals[0].items[0].grams = 0;
    expect(problems(nutritionPlanV1, zeroGrams).join()).toMatch(/grams/);
  });

  it("enforces gramsPerUnit for ml, l and piece, and forbids it for g and kg", () => {
    const base = {
      foodKey: "example_food",
      priceInr: 6,
      perQty: 1,
      asOf: "2026-10-13",
      source: "EXAMPLE",
      isEstimate: true,
    };
    const plan = (price) => ({
      ...nutritionExample(),
      prices: [{ ...base, ...price }],
    });
    expect(problems(nutritionPlanV1, plan({ unit: "piece" })).join()).toMatch(
      /required for unit "piece"/,
    );
    expect(
      problems(nutritionPlanV1, plan({ unit: "piece", gramsPerUnit: 50 })),
    ).toEqual([]);
    expect(
      problems(
        nutritionPlanV1,
        plan({ unit: "kg", gramsPerUnit: 1000 }),
      ).join(),
    ).toMatch(/leave this out/);
  });

  it("requires every referenced food to be defined, once", () => {
    const missing = nutritionExample();
    missing.days[0].meals[0].items[0].foodKey = "paneer";
    expect(problems(nutritionPlanV1, missing).join()).toMatch(
      /food "paneer" isn't defined/,
    );

    const dup = nutritionExample();
    dup.foods.push({ ...dup.foods[0] });
    expect(problems(nutritionPlanV1, dup).join()).toMatch(
      /food key "example_food" appears more than once/,
    );
  });

  it("allows one entry per day, inside the plan dates", () => {
    const dup = nutritionExample();
    dup.days.push(structuredClone(dup.days[0]));
    expect(problems(nutritionPlanV1, dup).join()).toMatch(
      /day "2026-10-14" appears more than once/,
    );
  });

  it("requires a source and an honest isEstimate on every food", () => {
    const noSource = nutritionExample();
    noSource.foods[0].source = " ";
    delete noSource.foods[0].isEstimate;
    const text = problems(nutritionPlanV1, noSource).join();
    expect(text).toMatch(/source: can't be empty/);
    expect(text).toMatch(/isEstimate/);
  });
});
