import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  addDays,
  diffDays,
  isDateString,
  isWithinRange,
  isoWeekOf,
  rangeDates,
  startOfIsoWeek,
  todayIn,
  weekdayOf,
} from "./dates.js";

describe("todayIn", () => {
  it("defaults to India time", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Kolkata");
    expect(todayIn(undefined, new Date("2026-10-13T06:00:00Z"))).toBe(
      "2026-10-13",
    );
  });

  it("rolls over at IST midnight (18:30 UTC), not UTC midnight", () => {
    expect(todayIn(APP_TIME_ZONE, new Date("2026-10-13T18:29:59.999Z"))).toBe(
      "2026-10-13",
    );
    expect(todayIn(APP_TIME_ZONE, new Date("2026-10-13T18:30:00.000Z"))).toBe(
      "2026-10-14",
    );
  });

  it("handles the 00:00–05:30 IST window where the UTC date is still yesterday", () => {
    const at0100Ist = new Date("2026-10-13T19:30:00Z");
    expect(todayIn(APP_TIME_ZONE, at0100Ist)).toBe("2026-10-14");
    expect(todayIn("UTC", at0100Ist)).toBe("2026-10-13");
  });
});

describe("isDateString", () => {
  it("accepts real calendar dates", () => {
    expect(isDateString("2026-10-13")).toBe(true);
    expect(isDateString("2028-02-29")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    for (const bad of [
      "2026-02-29",
      "2026-02-30",
      "2026-13-01",
      "2026-1-01",
      "2026-10-13T00:00",
      "",
      null,
      20261013,
    ]) {
      expect(isDateString(bad)).toBe(false);
    }
  });
});

describe("addDays / diffDays", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-10-13", 0)).toBe("2026-10-13");
  });

  it("counts whole days between dates", () => {
    expect(diffDays("2026-10-13", "2026-11-21")).toBe(39);
    expect(diffDays("2026-11-21", "2026-10-13")).toBe(-39);
    expect(diffDays("2026-10-13", "2026-10-13")).toBe(0);
  });

  it("is the inverse of addDays", () => {
    expect(diffDays("2026-10-13", addDays("2026-10-13", -30))).toBe(-30);
  });

  it("throws on invalid input instead of guessing", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("2026-10-13", 1.5)).toThrow(RangeError);
    expect(() => diffDays("13-10-2026", "2026-10-13")).toThrow(RangeError);
  });
});

describe("weekdayOf", () => {
  it("uses 0 = Sunday … 6 = Saturday", () => {
    expect(weekdayOf("2026-10-18")).toBe(0); // Sunday
    expect(weekdayOf("2026-10-12")).toBe(1); // Monday (Chinmay's vegetarian day)
    expect(weekdayOf("2026-10-13")).toBe(2); // Tuesday
    expect(weekdayOf("2026-10-15")).toBe(4); // Thursday (Chinmay's vegetarian day)
    expect(weekdayOf("2026-11-21")).toBe(6); // Saturday, race day 1
  });
});

describe("ISO weeks", () => {
  it("starts weeks on Monday", () => {
    expect(startOfIsoWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfIsoWeek("2026-10-12")).toBe("2026-10-12");
    expect(startOfIsoWeek("2027-01-01")).toBe("2026-12-28");
  });

  it("labels weeks by the year of their Thursday", () => {
    expect(isoWeekOf("2026-10-13")).toBe("2026-W42");
    expect(isoWeekOf("2026-01-01")).toBe("2026-W01");
    expect(isoWeekOf("2027-01-01")).toBe("2026-W53");
    expect(isoWeekOf("2027-01-04")).toBe("2027-W01");
    expect(isoWeekOf("2024-12-30")).toBe("2025-W01");
  });
});

describe("rangeDates / isWithinRange", () => {
  it("lists every date inclusive", () => {
    const festival = rangeDates("2026-10-11", "2026-10-20");
    expect(festival).toHaveLength(10);
    expect(festival[0]).toBe("2026-10-11");
    expect(festival.at(-1)).toBe("2026-10-20");
    expect(rangeDates("2026-10-13", "2026-10-13")).toEqual(["2026-10-13"]);
    expect(rangeDates("2026-10-14", "2026-10-13")).toEqual([]);
  });

  it("checks inclusive bounds", () => {
    expect(isWithinRange("2026-10-11", "2026-10-11", "2026-10-20")).toBe(true);
    expect(isWithinRange("2026-10-20", "2026-10-11", "2026-10-20")).toBe(true);
    expect(isWithinRange("2026-10-21", "2026-10-11", "2026-10-20")).toBe(false);
    expect(() =>
      isWithinRange("2026-10-32", "2026-10-11", "2026-10-20"),
    ).toThrow(RangeError);
  });
});
