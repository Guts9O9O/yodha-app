import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  day,
  id,
  instant,
  onboardingSectionEnum,
  sexEnum,
  sharingCategoryEnum,
  teamRoleEnum,
  timestamps,
  trainingExperienceEnum,
} from "./_shared.js";
import { user } from "./auth.js";

// Identity, teams and sharing (docs/ARCHITECTURE.md §2.2). Domain tables reference
// athlete_profile.id, never user.id. Owned rows cascade when their athlete is deleted;
// "created by" style references are nullable and set to null instead.

export const athleteProfile = pgTable(
  "athlete_profile",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    // Used by imports and per-athlete JSON; never changes after creation.
    athleteKey: text().notNull().unique(),
    displayName: text().notNull(),
    dateOfBirth: day(),
    sex: sexEnum(),
    heightCm: numeric({ precision: 4, scale: 1, mode: "number" }),
    trainingExperience: trainingExperienceEnum(),
    availabilityDays: smallint()
      .array()
      .notNull()
      .default(sql`'{}'`),
    availabilityStartTime: time(),
    availabilityMaxMinutes: smallint(),
    timezone: text().notNull().default("Asia/Kolkata"),
    onboardingCompletedAt: instant(),
    ...timestamps(),
  },
  (t) => [
    check(
      "athlete_profile_key_format",
      sql`${t.athleteKey} ~ '^[a-z][a-z0-9_]{1,30}$'`,
    ),
    check(
      "athlete_profile_height_range",
      sql`${t.heightCm} between 100 and 250`,
    ),
    check(
      "athlete_profile_availability_days",
      sql`${t.availabilityDays} <@ array[0,1,2,3,4,5,6]::smallint[]`,
    ),
    check(
      "athlete_profile_max_minutes_range",
      sql`${t.availabilityMaxMinutes} between 1 and 600`,
    ),
  ],
);

// Raw onboarding answers, one row per question-set section. Always owner-only, including the
// health screen; structured answers are also copied to their own tables.
export const onboardingResponse = pgTable(
  "onboarding_response",
  {
    id: id(),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    questionSetKey: text().notNull(),
    questionSetVersion: smallint().notNull(),
    section: onboardingSectionEnum().notNull(),
    answers: jsonb().notNull(),
    healthFlag: boolean().notNull().default(false),
    completedAt: instant(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("onboarding_response_section_unique").on(
      t.athleteId,
      t.questionSetKey,
      t.questionSetVersion,
      t.section,
    ),
    check(
      "onboarding_response_version_positive",
      sql`${t.questionSetVersion} > 0`,
    ),
  ],
);

export const team = pgTable(
  "team",
  {
    id: id(),
    name: text().notNull(),
    createdByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [index("team_created_by_idx").on(t.createdByAthleteId)],
);

// App rule (not a constraint): a team has at most its race entry's team_size members.
export const teamMember = pgTable(
  "team_member",
  {
    teamId: uuid()
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    role: teamRoleEnum().notNull().default("member"),
    joinedAt: instant().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.athleteId] }),
    index("team_member_athlete_idx").on(t.athleteId),
  ],
);

// Invite links carry a random token; only its SHA-256 is stored.
export const teamInvite = pgTable(
  "team_invite",
  {
    id: id(),
    teamId: uuid()
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    createdByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    expiresAt: instant().notNull(),
    acceptedByAthleteId: uuid().references(() => athleteProfile.id, {
      onDelete: "set null",
    }),
    acceptedAt: instant(),
    revokedAt: instant(),
    createdAt: instant().notNull().defaultNow(),
  },
  (t) => [
    index("team_invite_team_idx").on(t.teamId),
    index("team_invite_created_by_idx").on(t.createdByAthleteId),
    index("team_invite_accepted_by_idx").on(t.acceptedByAthleteId),
  ],
);

// A missing row means the category's default (docs/ARCHITECTURE.md §4.3).
export const sharingSetting = pgTable(
  "sharing_setting",
  {
    athleteId: uuid()
      .notNull()
      .references(() => athleteProfile.id, { onDelete: "cascade" }),
    category: sharingCategoryEnum().notNull(),
    visibleToTeam: boolean().notNull(),
    updatedAt: instant()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.athleteId, t.category] })],
);
