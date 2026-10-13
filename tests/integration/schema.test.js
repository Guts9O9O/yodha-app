import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db/client.js";

// The migrated schema matches docs/ARCHITECTURE.md §2: 37 app tables + 4 auth tables.
describe("migrated schema", () => {
  afterAll(closeDb);

  it("has every table", async () => {
    const { rows } = await getDb().execute(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'
            and table_name not like '__drizzle%'
          order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toHaveLength(41);
    expect(names).toEqual(
      expect.arrayContaining([
        "user",
        "athlete_profile",
        "plan_version",
        "food_revision",
        "food_price",
        "daily_checkin",
        "station_split",
      ]),
    );
  });

  it("stores date-only columns as date and instants as timestamptz", async () => {
    const { rows } = await getDb().execute(
      sql`select table_name, column_name, data_type from information_schema.columns
          where table_schema = 'public'
            and (table_name, column_name) in (('workout_log', 'date'), ('diet_rule', 'start_date'),
                                              ('daily_checkin', 'created_at'), ('plan_version', 'approved_at'))
          order by table_name, column_name`,
    );
    expect(
      rows.map((r) => `${r.table_name}.${r.column_name}:${r.data_type}`),
    ).toEqual([
      "daily_checkin.created_at:timestamp with time zone",
      "diet_rule.start_date:date",
      "plan_version.approved_at:timestamp with time zone",
      "workout_log.date:date",
    ]);
  });

  it("generates time-ordered uuidv7 primary keys", async () => {
    const { rows } = await getDb().execute(
      sql`select column_default from information_schema.columns
          where table_schema = 'public' and table_name = 'plan' and column_name = 'id'`,
    );
    expect(rows[0].column_default).toBe("uuidv7()");
  });
});
