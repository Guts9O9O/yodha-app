import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/server/db/client.js";
import { loadViewer } from "@/server/dal/viewer.js";
import { resetDatabase } from "../helpers/db.js";
import { createAthlete, createTeam, createUser } from "../helpers/factories.js";

describe("loadViewer", () => {
  beforeEach(resetDatabase);
  afterAll(closeDb);

  it("has no athlete or teams before onboarding", async () => {
    const account = await createUser();
    const viewer = await loadViewer(account);
    expect(viewer.athlete).toBeNull();
    expect(viewer.teamIds).toEqual([]);
    expect(viewer.teammateAthleteIds).toEqual([]);
  });

  it("finds the viewer's profile, team and teammate, and nobody else", async () => {
    const a = await createAthlete({ key: "athlete_a" });
    const b = await createAthlete({ key: "athlete_b" });
    const stranger = await createAthlete({ key: "stranger" });
    const pair = await createTeam([a.athlete.id, b.athlete.id]);
    await createTeam([stranger.athlete.id]);

    const viewer = await loadViewer(a.user);
    expect(viewer.athlete).toMatchObject({
      id: a.athlete.id,
      key: "athlete_a",
    });
    expect(viewer.teamIds).toEqual([pair.id]);
    expect(viewer.teammateAthleteIds).toEqual([b.athlete.id]);

    const strangerView = await loadViewer(stranger.user);
    expect(strangerView.teammateAthleteIds).toEqual([]);
  });

  it("is built from the session user only and can't be modified", async () => {
    const a = await createAthlete();
    const viewer = await loadViewer(a.user);
    expect(viewer.userId).toBe(a.user.id);
    expect(Object.isFrozen(viewer)).toBe(true);
    expect(Object.isFrozen(viewer.teammateAthleteIds)).toBe(true);
  });
});
