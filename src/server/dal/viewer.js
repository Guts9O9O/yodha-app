import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { athleteProfile, teamMember } from "../db/schema/index.js";

/**
 * The signed-in person, built only from the verified session (never from client input).
 * Every other DAL function takes one of these (docs/ARCHITECTURE.md §4.2).
 * @typedef {object} Viewer
 * @property {string} userId
 * @property {string} email
 * @property {string} name
 * @property {{ id: string, key: string, displayName: string } | null} athlete
 *   null until onboarding creates the athlete profile
 * @property {readonly string[]} teamIds
 * @property {readonly string[]} teammateAthleteIds athletes sharing at least one team with the viewer
 */

/**
 * Build the viewer for an authenticated user. This is the one DAL function that takes a user
 * rather than a viewer, because it's how a viewer is made.
 * @param {{ id: string, email: string, name: string }} user from the verified session
 * @returns {Promise<Readonly<Viewer>>}
 */
export async function loadViewer(user) {
  const db = getDb();
  const [profile] = await db
    .select({
      id: athleteProfile.id,
      key: athleteProfile.athleteKey,
      displayName: athleteProfile.displayName,
    })
    .from(athleteProfile)
    .where(eq(athleteProfile.userId, user.id))
    .limit(1);

  let teamIds = [];
  let teammateAthleteIds = [];
  if (profile) {
    const memberships = await db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .where(eq(teamMember.athleteId, profile.id));
    teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length > 0) {
      const teammates = await db
        .selectDistinct({ athleteId: teamMember.athleteId })
        .from(teamMember)
        .where(
          and(
            inArray(teamMember.teamId, teamIds),
            ne(teamMember.athleteId, profile.id),
          ),
        );
      teammateAthleteIds = teammates.map((t) => t.athleteId);
    }
  }

  return Object.freeze({
    userId: user.id,
    email: user.email,
    name: user.name,
    athlete: profile ? Object.freeze(profile) : null,
    teamIds: Object.freeze(teamIds),
    teammateAthleteIds: Object.freeze(teammateAthleteIds),
  });
}
