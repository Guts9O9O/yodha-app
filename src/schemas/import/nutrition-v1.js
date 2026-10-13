import * as z from "zod";
import { DIET_TAGS, MEAL_TYPES, PRICE_UNITS } from "../../lib/enums.js";
import {
  athleteKey,
  checkPlanDates,
  checkUnique,
  clockTime,
  isoDate,
  longText,
  optional,
  optionalList,
  optionalText,
  planFields,
  range,
  requiredText,
  shortText,
  slug,
  textList,
} from "../common.js";

// Nutrition plan file, schemaVersion 1 (docs/IMPORT_FORMAT.md §2, §4). Covers the shape and every
// rule that needs only the file itself. Diet rules, totals, costs and food revisions need the
// database and are checked by the importer.

const nonNegative = z.number().min(0, "can't be negative");

const targets = z.strictObject({
  kcal: range.refine(([min]) => min > 0, "kcal min must be more than 0"),
  proteinG: optional(range),
  carbsG: optional(range),
  fatG: optional(range),
  fibreG: optional(range),
  fluidNote: longText,
  rationale: longText,
});

const per100g = z.strictObject({
  kcal: nonNegative,
  proteinG: nonNegative,
  carbsG: nonNegative,
  fatG: nonNegative,
  // null = unknown: fibre totals for days using this food show as incomplete.
  fibreG: optional(nonNegative),
});

const food = z.strictObject({
  key: slug,
  name: shortText,
  dietTag: z.enum(DIET_TAGS),
  per100g,
  householdMeasures: optionalList(
    z.strictObject({ label: requiredText(60), grams: z.number().positive() }),
  ),
  source: requiredText(300),
  isEstimate: z.boolean(),
});

const MASS_UNITS = ["g", "kg"];

const price = z
  .strictObject({
    foodKey: slug,
    priceInr: z.number().positive(),
    perQty: z.number().positive(),
    unit: z.enum(PRICE_UNITS),
    gramsPerUnit: optional(z.number().positive()),
    asOf: isoDate,
    source: requiredText(300),
    isEstimate: z.boolean(),
    // Already paid for: shown in the day's cost breakdown, left out of the budget comparison.
    excludeFromBudget: z
      .boolean()
      .nullish()
      .transform((value) => value ?? false),
  })
  .superRefine((p, ctx) => {
    if (MASS_UNITS.includes(p.unit) && p.gramsPerUnit !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["gramsPerUnit"],
        message: `leave this out for unit "${p.unit}"`,
      });
    }
    if (!MASS_UNITS.includes(p.unit) && p.gramsPerUnit === null) {
      ctx.addIssue({
        code: "custom",
        path: ["gramsPerUnit"],
        message: `is required for unit "${p.unit}" (grams in one ${p.unit})`,
      });
    }
  });

const item = z.strictObject({
  foodKey: slug,
  grams: z.number().positive().max(5000),
  household: optionalText(120),
});

const meal = z.strictObject({
  type: z.enum(MEAL_TYPES),
  time: optional(clockTime),
  name: shortText,
  items: z.array(item).min(1, "needs at least one item"),
  prep: longText,
  substitutions: textList,
});

const expectedTotals = z.strictObject({
  kcal: optional(nonNegative),
  proteinG: optional(nonNegative),
  carbsG: optional(nonNegative),
  fatG: optional(nonNegative),
  fibreG: optional(nonNegative),
  costInr: optional(nonNegative),
});

const day = z.strictObject({
  date: isoDate,
  meals: z.array(meal).min(1, "needs at least one meal"),
  expectedTotals: optional(expectedTotals),
});

export const nutritionPlanV1 = z
  .strictObject({
    ...planFields,
    kind: z.literal("nutrition"),
    athlete: athleteKey,
    budgetInrPerDay: optional(z.number().positive()),
    targets: optional(targets),
    foods: z.array(food).min(1, "needs at least one food").max(500),
    prices: optionalList(price, 1000),
    days: z.array(day).min(1, "needs at least one day"),
  })
  .superRefine((plan, ctx) => {
    checkPlanDates(plan, ctx);
    checkUnique(
      plan.foods.map((f) => f.key),
      ctx,
      (i) => ["foods", i, "key"],
      "food key",
    );
    checkUnique(
      plan.days.map((d) => d.date),
      ctx,
      (i) => ["days", i, "date"],
      "day",
    );

    const foodKeys = new Set(plan.foods.map((f) => f.key));
    const undefinedFood = (key) => `food "${key}" isn't defined in foods`;
    plan.prices.forEach((p, i) => {
      if (!foodKeys.has(p.foodKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["prices", i, "foodKey"],
          message: undefinedFood(p.foodKey),
        });
      }
    });
    plan.days.forEach((d, di) => {
      if (d.date < plan.startDate || d.date > plan.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["days", di, "date"],
          message: `${d.date} is outside ${plan.startDate}–${plan.endDate}`,
        });
      }
      d.meals.forEach((m, mi) =>
        m.items.forEach((it, ii) => {
          if (!foodKeys.has(it.foodKey)) {
            ctx.addIssue({
              code: "custom",
              path: ["days", di, "meals", mi, "items", ii, "foodKey"],
              message: undefinedFood(it.foodKey),
            });
          }
        }),
      );
    });
  });
