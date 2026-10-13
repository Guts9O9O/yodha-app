import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db/client.js";

describe("database client", () => {
  afterAll(closeDb);

  it("connects to the Postgres 18 test database", async () => {
    const { rows } = await getDb().execute(
      sql`select current_database() as name, current_setting('server_version_num')::int as version`,
    );
    expect(rows[0].name).toMatch(/_test$/);
    expect(rows[0].version).toBeGreaterThanOrEqual(180000);
  });

  it("keeps DATE values as 'YYYY-MM-DD' strings through Drizzle", async () => {
    const { rows } = await getDb().execute(
      sql`select date '2026-11-21' as race_day`,
    );
    expect(rows[0].race_day).toBe("2026-11-21");
  });

  it("keeps DATE values as strings for raw pg clients too (global type parser)", async () => {
    getDb(); // importing client.js installs the parser; make sure it has run
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    try {
      const { rows } = await client.query(
        "select date '2026-11-21' as race_day",
      );
      expect(rows[0].race_day).toBe("2026-11-21");
    } finally {
      await client.end();
    }
  });
});
