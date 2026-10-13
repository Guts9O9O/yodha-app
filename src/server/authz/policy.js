// Who may read or write what (docs/ARCHITECTURE.md §4.3). Pure: callers pass the viewer and the
// owner's stored sharing settings, so the rules can be tested exhaustively without a database.
// Every unknown case fails closed.

import { SHARING_CATEGORIES } from "../../lib/enums.js";

/**
 * Partner visibility when the owner hasn't chosen. Shared: training and benchmarks.
 * Private: nutrition (meal plans, targets, logs, diet rules), body weight and check-ins.
 */
export const SHARING_DEFAULTS = Object.freeze({
  training: true,
  benchmarks: true,
  nutrition: false,
  body_weight: false,
  checkins: false,
});

/** Data that is never shared, whatever the settings: onboarding answers incl. the health screen. */
export const ALWAYS_PRIVATE = "always_private";

/**
 * @typedef {import("../dal/viewer.js").Viewer} Viewer
 * @typedef {Partial<Record<string, boolean>>} SharingSettings stored rows as { category: visibleToTeam }
 */

/**
 * Effective team visibility of one category for one owner.
 * @param {string} category
 * @param {SharingSettings} [ownerSettings]
 */
export function isSharedWithTeam(category, ownerSettings = {}) {
  if (!SHARING_CATEGORIES.includes(category)) return false;
  return ownerSettings[category] ?? SHARING_DEFAULTS[category];
}

/**
 * May the viewer read an athlete's data in this category?
 * @param {Viewer} viewer
 * @param {string} ownerAthleteId
 * @param {string} category a sharing category, or ALWAYS_PRIVATE
 * @param {SharingSettings} [ownerSettings]
 */
export function canReadAthleteData(
  viewer,
  ownerAthleteId,
  category,
  ownerSettings,
) {
  if (!viewer.athlete) return false;
  if (viewer.athlete.id === ownerAthleteId) return true;
  if (category === ALWAYS_PRIVATE) return false;
  if (!viewer.teammateAthleteIds.includes(ownerAthleteId)) return false;
  return isSharedWithTeam(category, ownerSettings);
}

/** Only the owner writes athlete-owned data. */
export function canWriteAthleteData(
  /** @type {Viewer} */ viewer,
  ownerAthleteId,
) {
  return viewer.athlete !== null && viewer.athlete.id === ownerAthleteId;
}

/** Team-owned data (team plans, joint sessions, team checklist, splits): any member reads and writes. */
export function canAccessTeamData(/** @type {Viewer} */ viewer, teamId) {
  return viewer.athlete !== null && viewer.teamIds.includes(teamId);
}
