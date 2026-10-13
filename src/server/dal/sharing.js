import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { SHARING_CATEGORIES } from "../../lib/enums.js";
import { canReadAthleteData } from "../authz/policy.js";
import { getDb } from "../db/client.js";
import { sharingSetting } from "../db/schema/index.js";

/**
 * Athlete ids whose data in `category` the viewer may read: always the viewer, plus teammates
 * who share that category (stored setting or default). Every athlete-owned read in the DAL scopes
 * its SQL with this, e.g. `where athlete_id in (readableAthleteIds(viewer, "checkins"))`.
 * @param {import("./viewer.js").Viewer} viewer
 * @param {string} category a sharing category, or ALWAYS_PRIVATE
 * @returns {Promise<string[]>}
 */
export async function readableAthleteIds(viewer, category) {
  if (!viewer.athlete) return [];
  const ids = [viewer.athlete.id];
  // Always-private data, unknown categories (fail closed) and no team: the viewer only.
  if (
    !SHARING_CATEGORIES.includes(category) ||
    viewer.teammateAthleteIds.length === 0
  ) {
    return ids;
  }

  const rows = await getDb()
    .select({
      athleteId: sharingSetting.athleteId,
      visibleToTeam: sharingSetting.visibleToTeam,
    })
    .from(sharingSetting)
    .where(
      and(
        inArray(sharingSetting.athleteId, [...viewer.teammateAthleteIds]),
        eq(sharingSetting.category, category),
      ),
    );
  const stored = new Map(rows.map((r) => [r.athleteId, r.visibleToTeam]));

  for (const teammateId of viewer.teammateAthleteIds) {
    const settings = stored.has(teammateId)
      ? { [category]: stored.get(teammateId) }
      : {};
    if (canReadAthleteData(viewer, teammateId, category, settings)) {
      ids.push(teammateId);
    }
  }
  return ids;
}
