import * as z from "zod";
import { SESSION_TYPES } from "../../lib/enums.js";
import {
  athleteKey,
  checkPlanDates,
  checkUnique,
  isoDate,
  longText,
  optional,
  optionalList,
  optionalText,
  planFields,
  rpe,
  shortText,
  slug,
  textList,
} from "../common.js";

// Training plan file, schemaVersion 1 (docs/IMPORT_FORMAT.md §2–3). Covers the shape and every
// rule that needs only the file itself. Checks that need the database (athletes exist, station
// keys, plan ownership, run spikes) happen in the importer.

const load = z
  .strictObject({
    kg: optional(z.number().positive().max(500)),
    guidance: optionalText(120),
  })
  .refine(
    (l) => l.kg !== null || l.guidance !== null,
    "give kg or guidance, or leave load out",
  );

// Fields an exercise and a per-athlete override share.
const prescriptionFields = {
  sets: optional(z.int().min(1).max(100)),
  reps: optional(z.int().min(1).max(1000)),
  distanceM: optional(z.number().positive().max(50000)),
  durationSec: optional(z.int().min(1).max(36000)),
  load: optional(load),
  restSec: optional(z.int().min(0).max(3600)),
  targetRpe: optional(rpe),
  notes: longText,
};

const override = z
  .strictObject(prescriptionFields)
  .refine(
    (o) => Object.values(o).some((value) => value !== null),
    "an override needs at least one field",
  );

const exercise = z
  .strictObject({
    name: shortText,
    // Generic category or a station key; which station keys exist is checked by the importer.
    category: slug,
    stationKey: optional(slug),
    ...prescriptionFields,
    perAthlete: optional(z.record(athleteKey, override)),
  })
  .superRefine((ex, ctx) => {
    if (ex.stationKey !== null && ex.stationKey !== ex.category) {
      ctx.addIssue({
        code: "custom",
        path: ["stationKey"],
        message: `must equal category ("${ex.category}") or be left out`,
      });
    }
  });

const block = z.strictObject({
  name: shortText,
  exercises: z.array(exercise).min(1, "needs at least one exercise"),
});

const session = z
  .strictObject({
    date: isoDate,
    athletes: z.array(athleteKey).min(1, "needs at least one athlete"),
    joint: z
      .boolean()
      .nullish()
      .transform((value) => value ?? false),
    type: z.enum(SESSION_TYPES),
    title: shortText,
    objective: longText,
    estimatedMinutes: optional(z.int().min(1).max(600)),
    warmup: textList,
    blocks: optionalList(block, 50),
    cooldown: textList,
    recovery: longText,
    stopCriteria: textList,
    lighterOption: longText,
  })
  .superRefine((s, ctx) => {
    checkUnique(s.athletes, ctx, (i) => ["athletes", i], "athlete");
    if (s.joint && s.athletes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["joint"],
        message: "a joint session needs at least 2 athletes",
      });
    }
    if (s.type !== "rest" && s.blocks.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["blocks"],
        message:
          "needs at least one block (only rest sessions may omit blocks)",
      });
    }
    s.blocks.forEach((b, bi) =>
      b.exercises.forEach((ex, ei) => {
        for (const key of Object.keys(ex.perAthlete ?? {})) {
          if (!s.athletes.includes(key)) {
            ctx.addIssue({
              code: "custom",
              path: ["blocks", bi, "exercises", ei, "perAthlete", key],
              message: `"${key}" isn't one of this session's athletes`,
            });
          }
        }
      }),
    );
  });

export const trainingPlanV1 = z
  .strictObject({
    ...planFields,
    kind: z.literal("training"),
    athletes: z.array(athleteKey).min(1, "needs at least one athlete"),
    eventCategory: optional(
      z
        .string()
        .regex(
          /^[a-z][a-z0-9_]{1,62}\/[a-z][a-z0-9_]{1,62}$/,
          'must look like "event_key/category_key"',
        ),
    ),
    sessions: z.array(session).min(1, "needs at least one session").max(500),
  })
  .superRefine((plan, ctx) => {
    checkPlanDates(plan, ctx);
    checkUnique(plan.athletes, ctx, (i) => ["athletes", i], "athlete");
    plan.sessions.forEach((s, i) => {
      if (s.date < plan.startDate || s.date > plan.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["sessions", i, "date"],
          message: `${s.date} is outside ${plan.startDate}–${plan.endDate}`,
        });
      }
      s.athletes.forEach((key, ai) => {
        if (!plan.athletes.includes(key)) {
          ctx.addIssue({
            code: "custom",
            path: ["sessions", i, "athletes", ai],
            message: `"${key}" isn't in the plan's athletes`,
          });
        }
      });
    });
  });
