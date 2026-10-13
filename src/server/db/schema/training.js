import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  benchmarkBetterEnum,
  benchmarkValueKindEnum,
  day,
  effortEnum,
  id,
  instant,
  sessionTypeEnum,
  timestamps,
  workoutStatusEnum,
} from "./_shared.js";
import { athleteProfile } from "./identity.js";
import { planVersion } from "./plans.js";
import { eventCategory, station } from "./race.js";

// Training plan content (immutable once imported), workout logs and benchmarks
// (docs/ARCHITECTURE.md §2.5). Ranges mirror IMPORT_FORMAT.md §3.

const SLUG = sql.raw(`'^[a-z][a-z0-9_]{1,62}$'`);

export const trainingSession = pgTable(
  "training_session",
  {
    id: id(),
    planVersionId: uuid()
      .notNull()
      .references(() => planVersion.id, { onDelete: "cascade" }),
    date: day().notNull(),
    // Order within the day (array order in the file).
    position: smallint().notNull(),
    type: sessionTypeEnum().notNull(),
    title: text().notNull(),
    objective: text(),
    estimatedMinutes: smallint(),
    joint: boolean().notNull().default(false),
    warmup: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    cooldown: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    recovery: text(),
    stopCriteria: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    lighterOption: text(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("training_session_day_position_unique").on(
      t.planVersionId,
      t.date,
      t.position,
    ),
    check("training_session_position", sql`${t.position} >= 0`),
    check(
      "training_session_minutes_range",
      sql`${t.estimatedMinutes} between 1 and 600`,
    ),
  ],
);

export const sessionAthlete = pgTable(
  "session_athlete",
  {
    sessionId: uuid()
      .notNull()
      .references(() => trainingSession.id, { onDelete: "cascade" }),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.athleteId] }),
    index("session_athlete_athlete_idx").on(t.athleteId),
  ],
);

export const sessionBlock = pgTable(
  "session_block",
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => trainingSession.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    name: text().notNull(),
  },
  (t) => [
    uniqueIndex("session_block_position_unique").on(t.sessionId, t.position),
    check("session_block_position", sql`${t.position} >= 0`),
  ],
);

export const exercisePrescription = pgTable(
  "exercise_prescription",
  {
    id: id(),
    blockId: uuid()
      .notNull()
      .references(() => sessionBlock.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    name: text().notNull(),
    // A generic category (run, strength, …) or a station key, checked at import.
    category: text().notNull(),
    stationId: uuid().references(() => station.id),
    sets: smallint(),
    reps: smallint(),
    distanceM: numeric({ precision: 8, scale: 1, mode: "number" }),
    durationSec: integer(),
    loadKg: numeric({ precision: 6, scale: 2, mode: "number" }),
    loadGuidance: text(),
    restSec: integer(),
    targetRpe: text(),
    targetRpeLow: smallint(),
    targetRpeHigh: smallint(),
    notes: text(),
    // { [athleteKey]: override }, same shape as the exercise (IMPORT_FORMAT.md §3.3).
    perAthlete: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("exercise_prescription_position_unique").on(
      t.blockId,
      t.position,
    ),
    index("exercise_prescription_station_idx").on(t.stationId),
    check("exercise_prescription_position", sql`${t.position} >= 0`),
    check(
      "exercise_prescription_category_format",
      sql`${t.category} ~ ${SLUG}`,
    ),
    check("exercise_prescription_sets", sql`${t.sets} between 1 and 100`),
    check("exercise_prescription_reps", sql`${t.reps} between 1 and 1000`),
    check(
      "exercise_prescription_distance",
      sql`${t.distanceM} > 0 and ${t.distanceM} <= 50000`,
    ),
    check(
      "exercise_prescription_duration",
      sql`${t.durationSec} between 1 and 36000`,
    ),
    check(
      "exercise_prescription_load",
      sql`${t.loadKg} > 0 and ${t.loadKg} <= 500`,
    ),
    check("exercise_prescription_rest", sql`${t.restSec} between 0 and 3600`),
    check(
      "exercise_prescription_rpe",
      sql`${t.targetRpeLow} between 1 and 10 and ${t.targetRpeHigh} between 1 and 10 and ${t.targetRpeLow} <= ${t.targetRpeHigh}`,
    ),
  ],
);

// What actually happened. Logged values may legitimately be 0 (e.g. a failed set).
// One log per athlete per planned session, so a double-tap can't create two.
export const workoutLog = pgTable(
  "workout_log",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    date: day().notNull(),
    sessionId: uuid().references(() => trainingSession.id),
    status: workoutStatusEnum().notNull(),
    actualMinutes: smallint(),
    sessionRpe: smallint(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("workout_log_session_unique").on(t.athleteId, t.sessionId),
    index("workout_log_athlete_date_idx").on(t.athleteId, t.date),
    index("workout_log_session_idx").on(t.sessionId),
    check(
      "workout_log_minutes_range",
      sql`${t.actualMinutes} between 0 and 1440`,
    ),
    check("workout_log_rpe_range", sql`${t.sessionRpe} between 1 and 10`),
  ],
);

export const setLog = pgTable(
  "set_log",
  {
    id: id(),
    workoutLogId: uuid()
      .notNull()
      .references(() => workoutLog.id, { onDelete: "cascade" }),
    prescriptionId: uuid().references(() => exercisePrescription.id),
    exercisePosition: smallint().notNull(),
    exerciseName: text().notNull(),
    // Needed to count run distance for unplanned runs.
    category: text().notNull(),
    setNumber: smallint().notNull(),
    reps: smallint(),
    loadKg: numeric({ precision: 6, scale: 2, mode: "number" }),
    distanceM: numeric({ precision: 8, scale: 1, mode: "number" }),
    durationSec: integer(),
    rpe: smallint(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("set_log_position_unique").on(
      t.workoutLogId,
      t.exercisePosition,
      t.setNumber,
    ),
    index("set_log_prescription_idx").on(t.prescriptionId),
    check("set_log_category_format", sql`${t.category} ~ ${SLUG}`),
    check(
      "set_log_numbers",
      sql`${t.exercisePosition} >= 0 and ${t.setNumber} >= 1`,
    ),
    check(
      "set_log_non_negative",
      sql`${t.reps} >= 0 and ${t.loadKg} >= 0 and ${t.distanceM} >= 0 and ${t.durationSec} >= 0`,
    ),
    check("set_log_rpe_range", sql`${t.rpe} between 1 and 10`),
  ],
);

// Built-in types have no owner; custom types belong to one athlete.
export const benchmarkType = pgTable(
  "benchmark_type",
  {
    id: id(),
    key: text().notNull(),
    name: text().notNull(),
    unit: text().notNull(),
    valueKind: benchmarkValueKindEnum().notNull(),
    better: benchmarkBetterEnum().notNull(),
    stationId: uuid().references(() => station.id),
    eventCategoryId: uuid().references(() => eventCategory.id),
    ownerAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "cascade",
    }),
    ...timestamps(),
  },
  (t) => [
    unique("benchmark_type_owner_key_unique")
      .on(t.ownerAthleteId, t.key)
      .nullsNotDistinct(),
    index("benchmark_type_station_idx").on(t.stationId),
    index("benchmark_type_category_idx").on(t.eventCategoryId),
    check("benchmark_type_key_format", sql`${t.key} ~ ${SLUG}`),
  ],
);

export const benchmark = pgTable(
  "benchmark",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    benchmarkTypeId: uuid()
      .notNull()
      .references(() => benchmarkType.id),
    date: day().notNull(),
    value: numeric({ precision: 10, scale: 2, mode: "number" }).notNull(),
    unit: text().notNull(),
    // Always recorded; "unknown" is an explicit choice.
    effort: effortEnum().notNull(),
    conditions: text(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    index("benchmark_athlete_type_date_idx").on(
      t.athleteId,
      t.benchmarkTypeId,
      t.date,
    ),
    index("benchmark_type_idx").on(t.benchmarkTypeId),
    check("benchmark_value_non_negative", sql`${t.value} >= 0`),
  ],
);
