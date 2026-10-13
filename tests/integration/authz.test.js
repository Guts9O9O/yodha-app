import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SHARING_CATEGORIES } from "@/lib/enums.js";
import { ALWAYS_PRIVATE, SHARING_DEFAULTS } from "@/server/authz/policy.js";
import { closeDb } from "@/server/db/client.js";
import { readableAthleteIds } from "@/server/dal/sharing.js";
import { loadViewer } from "@/server/dal/viewer.js";
import { resetDatabase } from "../helpers/db.js";
import { createAthlete, createTeam, setSharing } from "../helpers/factories.js";

// Cross-user access matrix (docs/ARCHITECTURE.md §4.5): self, teammate and stranger, for every
// category, with default, shared and unshared settings. Feature DALs build on readableAthleteIds,
// and each feature milestone adds its own read/IDOR tests on top.

let a, b, stranger;

async function viewerOf(person) {
  return loadViewer(person.user);
}

beforeEach(async () => {
  await resetDatabase();
  a = await createAthlete({ key: "athlete_a" });
  b = await createAthlete({ key: "athlete_b" });
  stranger = await createAthlete({ key: "stranger" });
  await createTeam([a.athlete.id, b.athlete.id]);
  await createTeam([stranger.athlete.id]);
});

afterAll(closeDb);

describe.each(SHARING_CATEGORIES)("category %s", (category) => {
  it("is always readable by its owner", async () => {
    expect(await readableAthleteIds(await viewerOf(a), category)).toContain(
      a.athlete.id,
    );
  });

  it(`follows the default (${SHARING_DEFAULTS[category] ? "shared" : "private"}) for the partner`, async () => {
    const ids = await readableAthleteIds(await viewerOf(a), category);
    expect(ids.includes(b.athlete.id)).toBe(SHARING_DEFAULTS[category]);
  });

  it("becomes readable by the partner when shared, and stops as soon as it's unshared", async () => {
    await setSharing(b.athlete.id, category, true);
    expect(await readableAthleteIds(await viewerOf(a), category)).toContain(
      b.athlete.id,
    );

    await setSharing(b.athlete.id, category, false);
    expect(await readableAthleteIds(await viewerOf(a), category)).not.toContain(
      b.athlete.id,
    );
  });

  it("is never readable by a stranger, even when the owner shares it", async () => {
    await setSharing(a.athlete.id, category, true);
    const ids = await readableAthleteIds(await viewerOf(stranger), category);
    expect(ids).toEqual([stranger.athlete.id]);
  });
});

describe("always-private data (onboarding and health screen)", () => {
  it("is readable by its owner only", async () => {
    for (const category of SHARING_CATEGORIES)
      await setSharing(b.athlete.id, category, true);
    expect(await readableAthleteIds(await viewerOf(a), ALWAYS_PRIVATE)).toEqual(
      [a.athlete.id],
    );
  });
});

describe("one partner's setting doesn't leak the other's data", () => {
  it("keeps A's private nutrition from B when only B shares", async () => {
    await setSharing(b.athlete.id, "nutrition", true);
    const forB = await readableAthleteIds(await viewerOf(b), "nutrition");
    expect(forB).toEqual([b.athlete.id]);
  });
});

describe("unknown categories fail closed", () => {
  it("returns only the viewer for a misspelt category", async () => {
    await setSharing(b.athlete.id, "training", true);
    expect(await readableAthleteIds(await viewerOf(a), "trainng")).toEqual([
      a.athlete.id,
    ]);
  });
});
