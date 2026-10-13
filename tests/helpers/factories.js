import { getDb } from "@/server/db/client.js";
import {
  athleteProfile,
  sharingSetting,
  team,
  teamMember,
  user,
} from "@/server/db/schema/index.js";

// Test-only rows with obviously fake values (example.com). Never used outside tests.

let sequence = 0;
const next = () => ++sequence;

/** @param {{ email?: string, name?: string }} [overrides] */
export async function createUser(overrides = {}) {
  const n = next();
  const [row] = await getDb()
    .insert(user)
    .values({
      name: overrides.name ?? `Test User ${n}`,
      email: overrides.email ?? `user${n}@example.com`,
      emailVerified: true,
    })
    .returning();
  return row;
}

/**
 * A user with an athlete profile.
 * @param {{ key?: string, displayName?: string, email?: string }} [overrides]
 */
export async function createAthlete(overrides = {}) {
  const n = next();
  const key = overrides.key ?? `athlete_${n}`;
  const account = await createUser({
    email: overrides.email ?? `${key}@example.com`,
    name: overrides.displayName ?? key,
  });
  const [athlete] = await getDb()
    .insert(athleteProfile)
    .values({
      userId: account.id,
      athleteKey: key,
      displayName: overrides.displayName ?? key,
    })
    .returning();
  return { user: account, athlete };
}

/**
 * @param {string[]} athleteIds the first one is the owner
 * @param {{ name?: string }} [overrides]
 */
export async function createTeam(athleteIds, overrides = {}) {
  const [row] = await getDb()
    .insert(team)
    .values({
      name: overrides.name ?? `Team ${next()}`,
      createdByAthleteId: athleteIds[0] ?? null,
    })
    .returning();
  if (athleteIds.length > 0) {
    await getDb()
      .insert(teamMember)
      .values(
        athleteIds.map((athleteId, i) => ({
          teamId: row.id,
          athleteId,
          role: i === 0 ? "owner" : "member",
        })),
      );
  }
  return row;
}

/**
 * @param {string} athleteId
 * @param {string} category one of SHARING_CATEGORIES
 * @param {boolean} visibleToTeam
 */
export async function setSharing(athleteId, category, visibleToTeam) {
  await getDb()
    .insert(sharingSetting)
    .values({ athleteId, category, visibleToTeam })
    .onConflictDoUpdate({
      target: [sharingSetting.athleteId, sharingSetting.category],
      set: { visibleToTeam },
    });
}
