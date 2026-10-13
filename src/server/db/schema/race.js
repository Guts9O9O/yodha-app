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
  goalTypeEnum,
  id,
  ruleStatusEnum,
  ruleTopicEnum,
  stationMetricEnum,
  switchModeEnum,
  timestamps,
} from "./_shared.js";
import { athleteProfile, team } from "./identity.js";

// Race reference data (seeded in M4 from the verified rulebook) plus the two tables that point at
// an event category: race entries and goals (docs/ARCHITECTURE.md §2.2–2.3). A future event is
// new rows here, not new code.

export const event = pgTable(
  "event",
  {
    id: id(),
    key: text().notNull().unique(),
    name: text().notNull(),
    series: text().notNull(),
    season: text(),
    city: text(),
    startDate: day().notNull(),
    endDate: day().notNull(),
    timezone: text().notNull().default("Asia/Kolkata"),
    sourceUrls: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    verifiedAt: day(),
    reverifyNote: text(),
    ...timestamps(),
  },
  (t) => [
    check("event_key_format", sql`${t.key} ~ '^[a-z][a-z0-9_]{1,62}$'`),
    check("event_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const eventCategory = pgTable(
  "event_category",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    key: text().notNull(),
    name: text().notNull(),
    teamSize: smallint().notNull(),
    runSegmentM: integer(),
    runSegmentCount: smallint(),
    // The "medal" goal type reads this cut-off (Yoddha: 90 min = 5400 s).
    medalCutoffSec: integer(),
    loadReference: text(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("event_category_event_key_unique").on(t.eventId, t.key),
    check(
      "event_category_key_format",
      sql`${t.key} ~ '^[a-z][a-z0-9_]{1,62}$'`,
    ),
    check("event_category_team_size", sql`${t.teamSize} between 1 and 10`),
    check(
      "event_category_positive_numbers",
      sql`${t.runSegmentM} > 0 and ${t.runSegmentCount} > 0 and ${t.medalCutoffSec} > 0`,
    ),
  ],
);

// Columns for what code computes on (metric, target, switch rules); validated JSON for lists that
// are only displayed (movement standards, faults).
export const station = pgTable(
  "station",
  {
    id: id(),
    eventCategoryId: uuid()
      .notNull()
      .references(() => eventCategory.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    key: text().notNull(),
    name: text().notNull(),
    metric: stationMetricEnum().notNull(),
    target: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    loadKg: numeric({ precision: 6, scale: 2, mode: "number" }),
    loadSpec: text(),
    equipmentSpec: text(),
    movementStandards: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    switchMode: switchModeEnum().notNull(),
    maxSwitches: smallint(),
    partnerPosition: text(),
    doublesNotes: text(),
    faults: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("station_category_key_unique").on(t.eventCategoryId, t.key),
    uniqueIndex("station_category_position_unique").on(
      t.eventCategoryId,
      t.position,
    ),
    check("station_key_format", sql`${t.key} ~ '^[a-z][a-z0-9_]{1,62}$'`),
    check("station_target_positive", sql`${t.target} > 0`),
    check("station_load_positive", sql`${t.loadKg} > 0`),
    check(
      "station_switch_rule",
      sql`(${t.switchMode} = 'max_switches') = (${t.maxSwitches} is not null)`,
    ),
    check("station_max_switches_range", sql`${t.maxSwitches} >= 0`),
  ],
);

// General rules, penalties, kit, hydration and the unresolved items, each with its status.
export const ruleNote = pgTable(
  "rule_note",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    eventCategoryId: uuid().references(() => eventCategory.id, {
      onDelete: "cascade",
    }),
    stationId: uuid().references(() => station.id, { onDelete: "cascade" }),
    key: text().notNull(),
    topic: ruleTopicEnum().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    status: ruleStatusEnum().notNull(),
    workingAssumption: text(),
    sourceUrl: text(),
    verifiedAt: day(),
    position: smallint().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("rule_note_event_key_unique").on(t.eventId, t.key),
    index("rule_note_category_idx").on(t.eventCategoryId),
    index("rule_note_station_idx").on(t.stationId),
  ],
);

// A team's (or a solo athlete's) entry in an event category, with the wave details once known.
// Unique per owner and category; rows with a NULL owner column never conflict.
export const raceEntry = pgTable(
  "race_entry",
  {
    id: id(),
    eventCategoryId: uuid()
      .notNull()
      .references(() => eventCategory.id),
    teamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    athleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "cascade",
    }),
    waveDate: day(),
    waveTime: time(),
    reportingTime: time(),
    bib: text(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    check(
      "race_entry_one_owner",
      sql`num_nonnulls(${t.teamId}, ${t.athleteId}) = 1`,
    ),
    uniqueIndex("race_entry_team_unique").on(t.teamId, t.eventCategoryId),
    uniqueIndex("race_entry_athlete_unique").on(t.athleteId, t.eventCategoryId),
    index("race_entry_category_idx").on(t.eventCategoryId),
  ],
);

// Target times are seconds. At most one active goal per owner and event category.
export const goal = pgTable(
  "goal",
  {
    id: id(),
    athleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "cascade",
    }),
    teamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    eventCategoryId: uuid()
      .notNull()
      .references(() => eventCategory.id),
    goalType: goalTypeEnum().notNull(),
    targetTimeMinSec: integer(),
    targetTimeMaxSec: integer(),
    notes: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check("goal_one_owner", sql`num_nonnulls(${t.athleteId}, ${t.teamId}) = 1`),
    check(
      "goal_times_positive",
      sql`${t.targetTimeMinSec} > 0 and ${t.targetTimeMaxSec} > 0`,
    ),
    check(
      "goal_times_ordered",
      sql`${t.targetTimeMinSec} <= ${t.targetTimeMaxSec}`,
    ),
    check(
      "goal_time_target_has_time",
      sql`${t.goalType} <> 'time_target' or num_nonnulls(${t.targetTimeMinSec}, ${t.targetTimeMaxSec}) > 0`,
    ),
    uniqueIndex("goal_active_athlete_unique")
      .on(t.athleteId, t.eventCategoryId)
      .where(sql`${t.isActive}`),
    uniqueIndex("goal_active_team_unique")
      .on(t.teamId, t.eventCategoryId)
      .where(sql`${t.isActive}`),
    index("goal_category_idx").on(t.eventCategoryId),
  ],
);
