import { describe, expect, it } from "vitest";
import { SHARING_CATEGORIES } from "../../lib/enums.js";
import {
  ALWAYS_PRIVATE,
  SHARING_DEFAULTS,
  canAccessTeamData,
  canReadAthleteData,
  canWriteAthleteData,
  isSharedWithTeam,
} from "./policy.js";

const A = "athlete-a";
const B = "athlete-b";
const C = "athlete-c";

/** @returns {import("../dal/viewer.js").Viewer} */
function viewerFor(id, { teammates = [], teams = [] } = {}) {
  return {
    userId: `user-${id}`,
    email: `${id}@example.com`,
    name: id,
    athlete: { id, key: id.replace("-", "_"), displayName: id },
    teamIds: teams,
    teammateAthleteIds: teammates,
  };
}

const a = viewerFor(A, { teammates: [B], teams: ["team-ab"] });

describe("sharing defaults", () => {
  it("cover exactly the sharing categories", () => {
    expect(Object.keys(SHARING_DEFAULTS).sort()).toEqual(
      [...SHARING_CATEGORIES].sort(),
    );
  });

  it("share training and benchmarks, keep the rest private", () => {
    expect(SHARING_DEFAULTS).toEqual({
      training: true,
      benchmarks: true,
      nutrition: false,
      body_weight: false,
      checkins: false,
    });
  });

  it("fail closed for unknown categories", () => {
    expect(isSharedWithTeam("meals", { meals: true })).toBe(false);
  });
});

describe("canReadAthleteData", () => {
  it("always lets athletes read their own data, including the health screen", () => {
    for (const category of [...SHARING_CATEGORIES, ALWAYS_PRIVATE]) {
      expect(canReadAthleteData(a, A, category)).toBe(true);
    }
  });

  it("follows defaults for a teammate when no setting is stored", () => {
    for (const category of SHARING_CATEGORIES) {
      expect(canReadAthleteData(a, B, category), category).toBe(
        SHARING_DEFAULTS[category],
      );
    }
  });

  it("follows the owner's stored settings in both directions", () => {
    expect(canReadAthleteData(a, B, "training", { training: false })).toBe(
      false,
    );
    expect(canReadAthleteData(a, B, "nutrition", { nutrition: true })).toBe(
      true,
    );
    expect(canReadAthleteData(a, B, "body_weight", { checkins: true })).toBe(
      false,
    );
  });

  it("never shares always-private data, even with a teammate", () => {
    expect(
      canReadAthleteData(a, B, ALWAYS_PRIVATE, { [ALWAYS_PRIVATE]: true }),
    ).toBe(false);
  });

  it("never lets a stranger read anything, even shared categories", () => {
    for (const category of SHARING_CATEGORIES) {
      expect(canReadAthleteData(a, C, category, { [category]: true })).toBe(
        false,
      );
    }
  });

  it("gives a viewer without an athlete profile nothing", () => {
    const noProfile = { ...a, athlete: null };
    expect(canReadAthleteData(noProfile, A, "training")).toBe(false);
  });
});

describe("writes and team data", () => {
  it("lets only the owner write athlete data", () => {
    expect(canWriteAthleteData(a, A)).toBe(true);
    expect(canWriteAthleteData(a, B)).toBe(false);
  });

  it("lets team members, and only them, access team data", () => {
    expect(canAccessTeamData(a, "team-ab")).toBe(true);
    expect(canAccessTeamData(a, "team-other")).toBe(false);
    expect(canAccessTeamData({ ...a, athlete: null }, "team-ab")).toBe(false);
  });
});
