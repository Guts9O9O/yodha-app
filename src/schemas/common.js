import * as z from "zod";
import { diffDays, isDateString } from "../lib/dates.js";

// Shared building blocks for docs/IMPORT_FORMAT.md §1 (types, required/optional, null rules).
// Isomorphic: used by server-side validation and, later, client-side forms.

export const SLUG = /^[a-z][a-z0-9_]{1,62}$/;
export const ATHLETE_KEY = /^[a-z][a-z0-9_]{1,30}$/;

export const slug = z
  .string()
  .regex(
    SLUG,
    "must be lowercase letters, digits or _ (2–63 chars, starting with a letter)",
  );
export const athleteKey = z
  .string()
  .regex(ATHLETE_KEY, 'must be an athlete key like "chinmay" (2–31 chars)');
export const isoDate = z.iso.date({
  error: "must be a real date in YYYY-MM-DD form",
});
export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour time like 08:00");

/** "N" or "N-M", integers 1–10, N ≤ M. */
export const rpe = z
  .string()
  .regex(/^\d{1,2}(-\d{1,2})?$/, 'must look like "7" or "3-4"')
  .refine((value) => {
    const [low, high = low] = value.split("-").map(Number);
    return low >= 1 && high <= 10 && low <= high;
  }, "must be between 1 and 10, low before high");

/** Required text: trimmed, at least one non-space character. */
export const requiredText = (max) =>
  z
    .string({ error: "is required" })
    .trim()
    .min(1, "can't be empty")
    .max(max, `must be at most ${max} characters`);

/** Optional text: omitted, null or blank all mean "not specified" and become null. */
export const optionalText = (max) =>
  z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? null : value,
      z.string().trim().max(max, `must be at most ${max} characters`).nullish(),
    )
    .transform((value) => value ?? null);

export const shortText = requiredText(120);
export const longText = optionalText(2000);

/** Optional value: omitted or null become null. Zero stays zero. */
export const optional = (schema) =>
  schema.nullish().transform((value) => value ?? null);

/** Optional list: omitted, null or [] all mean "none" and become []. */
export const optionalList = (item, max = 50) =>
  z
    .array(item)
    .max(max, `can have at most ${max} entries`)
    .nullish()
    .transform((value) => value ?? []);

/** List of text items (each non-empty, ≤ 500 chars). */
export const textList = optionalList(requiredText(500));

/** [min, max] with 0 ≤ min ≤ max and max > 0. */
export const range = z
  .tuple([
    z.number().min(0, "can't be negative"),
    z.number().positive("must be more than 0"),
  ])
  .refine(([min, max]) => min <= max, "min must not be more than max");

/** Fields shared by every plan file (IMPORT_FORMAT.md §2). */
export const planFields = {
  schemaVersion: z.literal(1, { error: "schemaVersion must be 1" }),
  title: shortText,
  planKey: optional(slug),
  versionNote: longText,
  status: z
    .enum(["draft", "approved"], { error: 'must be "draft" or "approved"' })
    .nullish()
    .transform((value) => value ?? "draft"),
  startDate: isoDate,
  endDate: isoDate,
  assumptions: textList,
};

/**
 * Cross-field checks on the date range: endDate ≥ startDate and at most 366 days.
 * @param {{ startDate: string, endDate: string }} plan
 * @param {z.core.$RefinementCtx} ctx
 */
export function checkPlanDates(plan, ctx) {
  // Malformed dates already have their own issue; don't compare them.
  if (!isDateString(plan.startDate) || !isDateString(plan.endDate)) return;
  const span = diffDays(plan.startDate, plan.endDate);
  if (span < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "must be on or after startDate",
    });
  } else if (span > 365) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "a plan can span at most 366 days",
    });
  }
}

/** Reports every value that appears more than once. */
export function checkUnique(values, ctx, pathFor, what) {
  const seen = new Set();
  values.forEach((value, i) => {
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        path: pathFor(i),
        message: `${what} "${value}" appears more than once`,
      });
    }
    seen.add(value);
  });
}
