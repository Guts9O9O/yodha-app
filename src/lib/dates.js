// Date-only helpers. Plan and log days are 'YYYY-MM-DD' strings end to end and must never
// shift through UTC conversion, so every function here takes and returns strings and does
// its arithmetic on UTC midnight internally. This is the only module allowed to construct
// Dates from values (enforced by ESLint).

/** App timezone: all "today" logic is India time. */
export const APP_TIME_ZONE = "Asia/Kolkata";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * @param {string} date
 * @returns {number | null} UTC midnight in ms, or null if not a real 'YYYY-MM-DD' date
 */
function toUtcMs(date) {
  if (typeof date !== "string") return null;
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Date.UTC rolls 2026-02-30 over to March; reject anything that doesn't round-trip.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/** @param {string} date */
function requireUtcMs(date) {
  const ms = toUtcMs(date);
  if (ms === null) {
    throw new RangeError(
      `Expected a 'YYYY-MM-DD' date, got ${JSON.stringify(date)}`,
    );
  }
  return ms;
}

/** @param {number} ms */
function fromUtcMs(ms) {
  const d = new Date(ms);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * True for a real calendar date in 'YYYY-MM-DD' form ('2026-02-30' is false).
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDateString(value) {
  return toUtcMs(/** @type {string} */ (value)) !== null;
}

/**
 * The calendar date right now in a timezone (default: India).
 * @param {string} [timeZone]
 * @param {Date} [now] injectable for tests
 * @returns {string} 'YYYY-MM-DD'
 */
export function todayIn(timeZone = APP_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (/** @type {string} */ type) =>
    parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * @param {string} date 'YYYY-MM-DD'
 * @param {number} days may be negative
 * @returns {string}
 */
export function addDays(date, days) {
  if (!Number.isInteger(days))
    throw new RangeError(`days must be an integer, got ${days}`);
  return fromUtcMs(requireUtcMs(date) + days * MS_PER_DAY);
}

/**
 * Whole days from `from` to `to` (positive when `to` is later).
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function diffDays(from, to) {
  return Math.round((requireUtcMs(to) - requireUtcMs(from)) / MS_PER_DAY);
}

/**
 * Day of week, 0 = Sunday … 6 = Saturday (the diet-rule convention).
 * @param {string} date
 * @returns {number}
 */
export function weekdayOf(date) {
  return new Date(requireUtcMs(date)).getUTCDay();
}

/**
 * Monday of the ISO week (Mon–Sun) containing `date`.
 * @param {string} date
 * @returns {string}
 */
export function startOfIsoWeek(date) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/**
 * ISO 8601 week label, e.g. '2026-W42'. The week belongs to the year of its Thursday.
 * @param {string} date
 * @returns {string}
 */
export function isoWeekOf(date) {
  const thursday = addDays(startOfIsoWeek(date), 3);
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(diffDays(`${year}-01-01`, thursday) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Every date from `start` to `end`, inclusive. Empty when start > end.
 * @param {string} start
 * @param {string} end
 * @returns {string[]}
 */
export function rangeDates(start, end) {
  const count = diffDays(start, end);
  return Array.from({ length: Math.max(0, count + 1) }, (_, i) =>
    addDays(start, i),
  );
}

/**
 * Inclusive range check. ISO date strings compare correctly as strings once validated.
 * @param {string} date
 * @param {string} start
 * @param {string} end
 * @returns {boolean}
 */
export function isWithinRange(date, start, end) {
  requireUtcMs(date);
  requireUtcMs(start);
  requireUtcMs(end);
  return start <= date && date <= end;
}
