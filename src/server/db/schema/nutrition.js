import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  day,
  dietRestrictionEnum,
  dietRuleKindEnum,
  dietTagEnum,
  id,
  instant,
  mealTypeEnum,
  priceUnitEnum,
  timestamps,
} from "./_shared.js";
import { athleteProfile } from "./identity.js";
import { planImport, planVersion } from "./plans.js";

// Diet rules, foods (immutable composition revisions), prices, targets, meal plans and meal logs
// (docs/ARCHITECTURE.md §2.6). Ranges mirror IMPORT_FORMAT.md §4. Reminder: a CHECK passes when
// its expression is NULL, so shape checks spell out IS NOT NULL.

const SLUG = sql.raw(`'^[a-z][a-z0-9_]{1,62}$'`);

// Weekday: 0 = Sunday … 6 = Saturday. eggs_allowed NULL = pending (treated as not allowed).
export const dietRule = pgTable(
  "diet_rule",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    kind: dietRuleKindEnum().notNull(),
    weekday: smallint(),
    startDate: day(),
    endDate: day(),
    restriction: dietRestrictionEnum().notNull(),
    eggsAllowed: boolean(),
    excludedItems: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    note: text(),
    archivedAt: instant(),
    ...timestamps(),
  },
  (t) => [
    index("diet_rule_athlete_idx").on(t.athleteId),
    check(
      "diet_rule_shape",
      sql`(${t.kind} = 'weekday' and ${t.weekday} is not null and ${t.weekday} between 0 and 6 and ${t.startDate} is null and ${t.endDate} is null)
        or (${t.kind} = 'date_range' and ${t.weekday} is null and ${t.startDate} is not null and ${t.endDate} is not null and ${t.endDate} >= ${t.startDate})`,
    ),
  ],
);

// Food identity only; values live in revisions.
export const food = pgTable(
  "food",
  {
    id: id(),
    key: text().notNull().unique(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [check("food_key_format", sql`${t.key} ~ ${SLUG}`)],
);

// Immutable: changed values create a new revision, and plans/logs keep the one they used.
export const foodRevision = pgTable(
  "food_revision",
  {
    id: id(),
    foodId: uuid()
      .notNull()
      .references(() => food.id),
    revision: integer().notNull(),
    name: text().notNull(),
    dietTag: dietTagEnum().notNull(),
    // Per 100 g. Fibre may be unknown (NULL); the others are required.
    kcal: numeric({ precision: 7, scale: 2, mode: "number" }).notNull(),
    proteinG: numeric({ precision: 6, scale: 2, mode: "number" }).notNull(),
    carbsG: numeric({ precision: 6, scale: 2, mode: "number" }).notNull(),
    fatG: numeric({ precision: 6, scale: 2, mode: "number" }).notNull(),
    fibreG: numeric({ precision: 6, scale: 2, mode: "number" }),
    householdMeasures: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    source: text().notNull(),
    isEstimate: boolean().notNull(),
    contentHash: text().notNull(),
    createdByImportId: uuid().references(() => planImport.id, {
      onDelete: "set null",
    }),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("food_revision_number_unique").on(t.foodId, t.revision),
    uniqueIndex("food_revision_content_unique").on(t.foodId, t.contentHash),
    index("food_revision_import_idx").on(t.createdByImportId),
    check("food_revision_number_positive", sql`${t.revision} > 0`),
    check(
      "food_revision_values_non_negative",
      sql`${t.kcal} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0 and ${t.fibreG} >= 0`,
    ),
    check("food_revision_source_present", sql`length(btrim(${t.source})) > 0`),
  ],
);

// Cost resolves to grams: g/kg directly, ml/l/piece through grams_per_unit.
// exclude_from_budget: already paid for; shown in the cost breakdown, not counted against budget.
export const foodPrice = pgTable(
  "food_price",
  {
    id: id(),
    foodId: uuid()
      .notNull()
      .references(() => food.id),
    priceInr: numeric({ precision: 10, scale: 2, mode: "number" }).notNull(),
    perQty: numeric({ precision: 10, scale: 3, mode: "number" }).notNull(),
    unit: priceUnitEnum().notNull(),
    gramsPerUnit: numeric({ precision: 10, scale: 3, mode: "number" }),
    asOf: day().notNull(),
    source: text().notNull(),
    isEstimate: boolean().notNull(),
    excludeFromBudget: boolean().notNull().default(false),
    importId: uuid().references(() => planImport.id, { onDelete: "set null" }),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    // Also serves "latest price for a food on or before a date".
    uniqueIndex("food_price_food_date_source_unique").on(
      t.foodId,
      t.asOf,
      t.source,
    ),
    index("food_price_import_idx").on(t.importId),
    check(
      "food_price_positive",
      sql`${t.priceInr} > 0 and ${t.perQty} > 0 and ${t.gramsPerUnit} > 0`,
    ),
    check(
      "food_price_grams_per_unit",
      sql`(${t.unit} in ('g', 'kg')) = (${t.gramsPerUnit} is null)`,
    ),
    check("food_price_source_present", sql`length(btrim(${t.source})) > 0`),
  ],
);

// From an approved nutrition version (plan_version_id set) or entered manually (NULL).
// kcal is required; other ranges are optional but come as complete min/max pairs.
export const nutritionTarget = pgTable(
  "nutrition_target",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    planVersionId: uuid().references(() => planVersion.id, {
      onDelete: "cascade",
    }),
    effectiveFrom: day().notNull(),
    kcalMin: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    kcalMax: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    proteinGMin: numeric({ precision: 6, scale: 1, mode: "number" }),
    proteinGMax: numeric({ precision: 6, scale: 1, mode: "number" }),
    carbsGMin: numeric({ precision: 6, scale: 1, mode: "number" }),
    carbsGMax: numeric({ precision: 6, scale: 1, mode: "number" }),
    fatGMin: numeric({ precision: 6, scale: 1, mode: "number" }),
    fatGMax: numeric({ precision: 6, scale: 1, mode: "number" }),
    fibreGMin: numeric({ precision: 6, scale: 1, mode: "number" }),
    fibreGMax: numeric({ precision: 6, scale: 1, mode: "number" }),
    fluidNote: text(),
    rationale: text(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("nutrition_target_version_unique").on(t.planVersionId),
    index("nutrition_target_athlete_from_idx").on(t.athleteId, t.effectiveFrom),
    check(
      "nutrition_target_kcal",
      sql`${t.kcalMin} > 0 and ${t.kcalMin} <= ${t.kcalMax}`,
    ),
    ...[
      ["protein", t.proteinGMin, t.proteinGMax],
      ["carbs", t.carbsGMin, t.carbsGMax],
      ["fat", t.fatGMin, t.fatGMax],
      ["fibre", t.fibreGMin, t.fibreGMax],
    ].map(([name, min, max]) =>
      check(
        `nutrition_target_${name}_range`,
        sql`(${min} is null and ${max} is null) or (${min} is not null and ${max} is not null and ${min} >= 0 and ${max} > 0 and ${min} <= ${max})`,
      ),
    ),
  ],
);

// One meal plan per version per date. expected_* are the author's own totals, kept for the
// >5% comparison; the app computes real totals from foods × grams.
export const mealPlanDay = pgTable(
  "meal_plan_day",
  {
    id: id(),
    planVersionId: uuid()
      .notNull()
      .references(() => planVersion.id, { onDelete: "cascade" }),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    date: day().notNull(),
    expectedKcal: numeric({ precision: 7, scale: 1, mode: "number" }),
    expectedProteinG: numeric({ precision: 6, scale: 1, mode: "number" }),
    expectedCarbsG: numeric({ precision: 6, scale: 1, mode: "number" }),
    expectedFatG: numeric({ precision: 6, scale: 1, mode: "number" }),
    expectedFibreG: numeric({ precision: 6, scale: 1, mode: "number" }),
    expectedCostInr: numeric({ precision: 10, scale: 2, mode: "number" }),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("meal_plan_day_date_unique").on(t.planVersionId, t.date),
    index("meal_plan_day_athlete_date_idx").on(t.athleteId, t.date),
    check(
      "meal_plan_day_expected_non_negative",
      sql`${t.expectedKcal} >= 0 and ${t.expectedProteinG} >= 0 and ${t.expectedCarbsG} >= 0 and ${t.expectedFatG} >= 0 and ${t.expectedFibreG} >= 0 and ${t.expectedCostInr} >= 0`,
    ),
  ],
);

export const plannedMeal = pgTable(
  "planned_meal",
  {
    id: id(),
    mealPlanDayId: uuid()
      .notNull()
      .references(() => mealPlanDay.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    type: mealTypeEnum().notNull(),
    time: time(),
    name: text().notNull(),
    prep: text(),
    substitutions: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("planned_meal_position_unique").on(t.mealPlanDayId, t.position),
    check("planned_meal_position", sql`${t.position} >= 0`),
  ],
);

export const plannedMealItem = pgTable(
  "planned_meal_item",
  {
    id: id(),
    plannedMealId: uuid()
      .notNull()
      .references(() => plannedMeal.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    foodRevisionId: uuid()
      .notNull()
      .references(() => foodRevision.id),
    grams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    household: text(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("planned_meal_item_position_unique").on(
      t.plannedMealId,
      t.position,
    ),
    index("planned_meal_item_food_idx").on(t.foodRevisionId),
    check("planned_meal_item_position", sql`${t.position} >= 0`),
    check(
      "planned_meal_item_grams",
      sql`${t.grams} > 0 and ${t.grams} <= 5000`,
    ),
  ],
);

// What was actually eaten. One log per athlete per planned meal ("ate as planned" is idempotent).
export const mealLog = pgTable(
  "meal_log",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    date: day().notNull(),
    mealType: mealTypeEnum().notNull(),
    plannedMealId: uuid().references(() => plannedMeal.id),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("meal_log_planned_unique").on(t.athleteId, t.plannedMealId),
    index("meal_log_athlete_date_idx").on(t.athleteId, t.date),
    index("meal_log_planned_idx").on(t.plannedMealId),
  ],
);

export const mealLogItem = pgTable(
  "meal_log_item",
  {
    id: id(),
    mealLogId: uuid()
      .notNull()
      .references(() => mealLog.id, { onDelete: "cascade" }),
    foodRevisionId: uuid()
      .notNull()
      .references(() => foodRevision.id),
    plannedItemId: uuid().references(() => plannedMealItem.id),
    grams: numeric({ precision: 7, scale: 1, mode: "number" }).notNull(),
    ...timestamps(),
  },
  (t) => [
    index("meal_log_item_log_idx").on(t.mealLogId),
    index("meal_log_item_food_idx").on(t.foodRevisionId),
    index("meal_log_item_planned_idx").on(t.plannedItemId),
    check("meal_log_item_grams", sql`${t.grams} > 0 and ${t.grams} <= 5000`),
  ],
);
