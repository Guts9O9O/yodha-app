// Closed value sets shared by the database (Postgres enums) and the Zod schemas, so the two can't
// drift. Pure and isomorphic. Changing a list needs a migration and, after M0, the owner's OK
// (docs/ARCHITECTURE.md §2). Exercise `category` is deliberately not here: it's validated against
// the event's station keys at import time.

export const SEXES = ["male", "female"];
export const TRAINING_EXPERIENCE = ["none", "under_1y", "1_to_3y", "over_3y"];
export const ONBOARDING_SECTIONS = [
  "profile",
  "goal",
  "health",
  "sleep",
  "diet",
  "cooking",
  "partner",
];
export const TEAM_ROLES = ["owner", "member"];
export const SHARING_CATEGORIES = [
  "training",
  "benchmarks",
  "nutrition",
  "body_weight",
  "checkins",
];
export const GOAL_TYPES = ["finish", "medal", "podium", "time_target"];

export const STATION_METRICS = ["distance_m", "reps"];
export const SWITCH_MODES = ["max_switches", "free", "swap_zone_only"];
export const RULE_TOPICS = [
  "format",
  "general",
  "penalty",
  "kit",
  "hydration",
  "station",
  "logistics",
];
export const RULE_STATUSES = ["verified", "unconfirmed", "contradictory"];

export const PLAN_KINDS = ["training", "nutrition"];
export const IMPORT_STATUSES = [
  "previewed",
  "committed",
  "rejected",
  "expired",
];
export const VERSION_STATUSES = ["draft", "approved", "archived"];

export const SESSION_TYPES = [
  "run",
  "strength",
  "station",
  "combo",
  "mobility",
  "rest",
  "test",
];
/** Exercise categories that aren't station keys (IMPORT_FORMAT.md §3.3). */
export const GENERIC_EXERCISE_CATEGORIES = [
  "run",
  "strength",
  "conditioning",
  "mobility",
  "other",
];
export const WORKOUT_STATUSES = ["completed", "partial", "skipped"];
export const BENCHMARK_VALUE_KINDS = [
  "time_sec",
  "distance_m",
  "reps",
  "load_kg",
  "other",
];
export const BENCHMARK_BETTER = ["lower", "higher"];
export const EFFORT_LEVELS = ["easy", "moderate", "max", "unknown"];

export const DIET_RULE_KINDS = ["weekday", "date_range"];
export const DIET_RESTRICTIONS = ["vegetarian"];
export const DIET_TAGS = ["veg", "egg", "chicken", "fish", "other_meat"];
export const PRICE_UNITS = ["g", "kg", "ml", "l", "piece"];
export const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "pre_workout",
  "post_workout",
  "dinner",
  "snack",
];

export const RED_FLAGS = [
  "chest_pain",
  "fainting",
  "dizziness",
  "palpitations",
  "breathlessness",
  "sharp_pain",
];
export const CHECKLIST_CATEGORIES = ["kit", "admin", "race_week", "race_day"];
