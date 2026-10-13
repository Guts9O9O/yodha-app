import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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
  checklistCategoryEnum,
  day,
  id,
  instant,
  redFlagEnum,
  timestamps,
} from "./_shared.js";
import { athleteProfile, team } from "./identity.js";
import { raceEntry, station } from "./race.js";

// Daily check-ins, race checklists and station split plans (docs/ARCHITECTURE.md §2.7).

// One per athlete per day. Body weight follows the body_weight sharing category, not checkins.
export const dailyCheckin = pgTable(
  "daily_checkin",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    date: day().notNull(),
    sleepHours: numeric({ precision: 3, scale: 1, mode: "number" }),
    bedTime: time(),
    wakeTime: time(),
    sleepQuality: smallint(),
    soreness: smallint(),
    sorenessAreas: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    energy: smallint(),
    fluidL: numeric({ precision: 4, scale: 2, mode: "number" }),
    bodyWeightKg: numeric({ precision: 5, scale: 2, mode: "number" }),
    restingHr: smallint(),
    // Any red flag shows "stop training today and seek medical advice" (no diagnosis).
    redFlags: redFlagEnum()
      .array()
      .notNull()
      .default(sql`'{}'`),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("daily_checkin_athlete_date_unique").on(t.athleteId, t.date),
    check("daily_checkin_sleep_hours", sql`${t.sleepHours} between 0 and 24`),
    check(
      "daily_checkin_sleep_quality",
      sql`${t.sleepQuality} between 1 and 5`,
    ),
    check("daily_checkin_soreness", sql`${t.soreness} between 1 and 10`),
    check("daily_checkin_energy", sql`${t.energy} between 1 and 5`),
    check("daily_checkin_fluid", sql`${t.fluidL} between 0 and 15`),
    check(
      "daily_checkin_body_weight",
      sql`${t.bodyWeightKg} between 30 and 250`,
    ),
    check("daily_checkin_resting_hr", sql`${t.restingHr} between 25 and 220`),
  ],
);

// Team items are visible to the team. Individual items are visible to the partner unless the
// owner marks them private; only individual items can be private.
export const checklistItem = pgTable(
  "checklist_item",
  {
    id: id(),
    teamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    athleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "cascade",
    }),
    raceEntryId: uuid().references(() => raceEntry.id, {
      onDelete: "set null",
    }),
    title: text().notNull(),
    category: checklistCategoryEnum().notNull(),
    dueDate: day(),
    done: boolean().notNull().default(false),
    doneAt: instant(),
    doneByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    isPrivate: boolean().notNull().default(false),
    position: smallint().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("checklist_item_team_idx").on(t.teamId),
    index("checklist_item_athlete_idx").on(t.athleteId),
    index("checklist_item_race_entry_idx").on(t.raceEntryId),
    index("checklist_item_done_by_idx").on(t.doneByAthleteId),
    check(
      "checklist_item_one_owner",
      sql`num_nonnulls(${t.teamId}, ${t.athleteId}) = 1`,
    ),
    check(
      "checklist_item_private_individual_only",
      sql`not ${t.isPrivate} or ${t.athleteId} is not null`,
    ),
    check("checklist_item_done_at", sql`${t.done} = (${t.doneAt} is not null)`),
  ],
);

// Who does how much of each station: segments = [{ athleteKey, amount, atSwapZone }].
// Validated against the station's switch rules in src/lib (docs/ARCHITECTURE.md §5.5).
export const stationSplit = pgTable(
  "station_split",
  {
    id: id(),
    raceEntryId: uuid()
      .notNull()
      .references(() => raceEntry.id, { onDelete: "cascade" }),
    stationId: uuid()
      .notNull()
      .references(() => station.id),
    segments: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    planText: text(),
    notes: text(),
    updatedByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("station_split_entry_station_unique").on(
      t.raceEntryId,
      t.stationId,
    ),
    index("station_split_station_idx").on(t.stationId),
    index("station_split_updated_by_idx").on(t.updatedByAthleteId),
  ],
);
