// Prove a backup restores (docs/BACKUP.md), without touching production:
//   npm run db:restore-check -- backups/<file>.dump
// Restores into a throwaway yoddha_restore_check database in the LOCAL Docker Postgres
// (npm run db:up), prints table and row counts, then drops it.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const DB = "yoddha_restore_check";
const USER = "yoddha";
const COUNTED = [
  "user",
  "athlete_profile",
  "plan_version",
  "workout_log",
  "daily_checkin",
  "meal_log",
  "benchmark",
];

function compose(args, { allowFail = false } = {}) {
  const result = spawnSync("docker", ["compose", ...args], {
    encoding: "utf8",
  });
  if (result.error)
    throw new Error(`Couldn't run docker compose: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    throw new Error(
      `docker compose ${args.slice(0, 3).join(" ")} … failed:\n${result.stderr.trim()}`,
    );
  }
  return result;
}

function psql(sql) {
  return compose([
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    USER,
    "-d",
    DB,
    "-Atc",
    sql,
  ]).stdout.trim();
}

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("Usage: npm run db:restore-check -- backups/<file>.dump");
  process.exit(1);
}

try {
  compose(["up", "-d", "--wait", "db"]);
  compose(["exec", "-T", "db", "dropdb", "-U", USER, "--if-exists", DB]);
  compose(["exec", "-T", "db", "createdb", "-U", USER, DB]);
  compose(["cp", resolve(file), "db:/tmp/restore-check.dump"]);

  const restore = compose(
    [
      "exec",
      "-T",
      "db",
      "pg_restore",
      "-U",
      USER,
      "--no-owner",
      "--no-privileges",
      "-d",
      DB,
      "/tmp/restore-check.dump",
    ],
    { allowFail: true },
  );
  if (restore.status !== 0)
    throw new Error(`pg_restore reported errors:\n${restore.stderr.trim()}`);

  const tables = psql(
    "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not like '__drizzle%'",
  );
  console.log(`Restored ${basename(file)} into ${DB}: ${tables} tables.`);
  for (const table of COUNTED) {
    console.log(
      `  ${table.padEnd(16)} ${psql(`select count(*) from "${table}"`)} rows`,
    );
  }
  console.log("Restore check passed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  compose(["exec", "-T", "db", "dropdb", "-U", USER, "--if-exists", DB], {
    allowFail: true,
  });
  compose(["exec", "-T", "db", "rm", "-f", "/tmp/restore-check.dump"], {
    allowFail: true,
  });
}
