import { sql } from "drizzle-orm";
import {
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
  day,
  id,
  importStatusEnum,
  instant,
  planKindEnum,
  timestamps,
  versionStatusEnum,
} from "./_shared.js";
import { athleteProfile, team } from "./identity.js";
import { eventCategory } from "./race.js";

// Plans, imports and versions (docs/ARCHITECTURE.md §2.4, §5). Plan content hangs off a version
// and cascades with it; logs point at content with NO ACTION, so a version with logs can't be
// deleted, while deleting an account still cascades cleanly.

export const plan = pgTable(
  "plan",
  {
    id: id(),
    kind: planKindEnum().notNull(),
    planKey: text().notNull(),
    title: text().notNull(),
    ownerAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "cascade",
    }),
    ownerTeamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    // Context for resolving station keys in training plans.
    eventCategoryId: uuid().references(() => eventCategory.id),
    createdByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    check(
      "plan_one_owner",
      sql`num_nonnulls(${t.ownerAthleteId}, ${t.ownerTeamId}) = 1`,
    ),
    check(
      "plan_nutrition_owned_by_athlete",
      sql`${t.kind} <> 'nutrition' or ${t.ownerAthleteId} is not null`,
    ),
    check("plan_key_format", sql`${t.planKey} ~ '^[a-z][a-z0-9_]{1,62}$'`),
    unique("plan_owner_key_unique")
      .on(t.kind, t.ownerAthleteId, t.ownerTeamId, t.planKey)
      .nullsNotDistinct(),
    index("plan_owner_athlete_idx").on(t.ownerAthleteId),
    index("plan_owner_team_idx").on(t.ownerTeamId),
    index("plan_category_idx").on(t.eventCategoryId),
    index("plan_created_by_idx").on(t.createdByAthleteId),
  ],
);

// Every upload, including rejected ones: the exact text as uploaded plus the validation report.
// `kind` and `schemaVersion` are null when the file couldn't be parsed that far.
export const planImport = pgTable(
  "plan_import",
  {
    id: id(),
    importedByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    kind: planKindEnum(),
    schemaVersion: smallint(),
    rawText: text().notNull(),
    sha256: text().notNull(),
    status: importStatusEnum().notNull(),
    report: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: instant().notNull().defaultNow(),
    committedAt: instant(),
  },
  (t) => [
    check("plan_import_size_limit", sql`octet_length(${t.rawText}) <= 1048576`),
    check(
      "plan_import_committed_at",
      sql`(${t.status} = 'committed') = (${t.committedAt} is not null)`,
    ),
    index("plan_import_importer_recent_idx").on(
      t.importedByAthleteId,
      t.createdAt.desc(),
    ),
    index("plan_import_sha256_idx").on(t.sha256),
  ],
);

export const planVersion = pgTable(
  "plan_version",
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    versionNumber: integer().notNull(),
    status: versionStatusEnum().notNull().default("draft"),
    versionNote: text(),
    startDate: day().notNull(),
    endDate: day().notNull(),
    assumptions: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    budgetInrPerDay: numeric({ precision: 10, scale: 2, mode: "number" }),
    importId: uuid()
      .notNull()
      .unique()
      .references(() => planImport.id),
    createdByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    importedAt: instant().notNull().defaultNow(),
    approvedAt: instant(),
    approvedByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    archivedAt: instant(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("plan_version_number_unique").on(t.planId, t.versionNumber),
    // At most one live version per plan.
    uniqueIndex("plan_version_one_approved")
      .on(t.planId)
      .where(sql`${t.status} = 'approved'`),
    check("plan_version_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
    check("plan_version_number_positive", sql`${t.versionNumber} > 0`),
    check(
      "plan_version_approved_at",
      sql`${t.status} <> 'approved' or ${t.approvedAt} is not null`,
    ),
    check("plan_version_budget_positive", sql`${t.budgetInrPerDay} > 0`),
    index("plan_version_status_dates_idx").on(t.status, t.startDate, t.endDate),
    index("plan_version_created_by_idx").on(t.createdByAthleteId),
    index("plan_version_approved_by_idx").on(t.approvedByAthleteId),
  ],
);

// Which athletes a version covers: "approved content for athlete X on date D" is one join.
export const planVersionAthlete = pgTable(
  "plan_version_athlete",
  {
    planVersionId: uuid()
      .notNull()
      .references(() => planVersion.id, { onDelete: "cascade" }),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.planVersionId, t.athleteId] }),
    index("plan_version_athlete_athlete_idx").on(t.athleteId),
  ],
);
