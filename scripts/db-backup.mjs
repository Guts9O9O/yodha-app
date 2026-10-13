// Back up the production database (docs/BACKUP.md):
//   npm run db:backup
// Runs pg_dump inside the official postgres:18 image (nothing to install on Windows) against
// DATABASE_URL_DIRECT from .env.prod.local, and writes backups/yoddha-prod-YYYYMMDD-HHMM.dump.
// The connection string goes to the container through its environment, never its command line.
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describeDatabase } from "./db-migrate.mjs";

const BACKUP_DIR = fileURLToPath(new URL("../backups", import.meta.url));
const IMAGE = "postgres:18";

/** Throws unless the URL is a direct (non-pooled) Postgres connection string. */
export function assertDirectUrl(url) {
  if (!url) {
    throw new Error(
      "DATABASE_URL_DIRECT is not set (see docs/BACKUP.md, one-time setup).",
    );
  }
  const { protocol, hostname } = new URL(url);
  if (!/^postgres(ql)?:$/.test(protocol)) {
    throw new Error(
      "DATABASE_URL_DIRECT must be a postgres:// connection string.",
    );
  }
  if (hostname.includes("-pooler")) {
    throw new Error(
      "DATABASE_URL_DIRECT points at Neon's pooler. Use the direct connection string (no -pooler) for backups.",
    );
  }
}

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function docker(args, env = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.error) {
    throw new Error(
      `Couldn't run docker (is Docker Desktop running?): ${result.error.message}`,
    );
  }
  return result;
}

/**
 * Dump the database at `url` into backups/. Returns the file path.
 * @param {string} url direct connection string
 * @param {string} [label] file name prefix
 */
export function backupDatabase(url, label = "yoddha-prod") {
  assertDirectUrl(url);
  mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = `${label}-${stamp()}.dump`;

  const dump = docker(
    [
      "run",
      "--rm",
      "-e",
      "DUMP_URL", // value comes from the env below, not the command line
      "-v",
      `${BACKUP_DIR}:/backups`,
      IMAGE,
      "sh",
      "-c",
      `pg_dump "$DUMP_URL" --format=custom --no-owner --no-privileges --file "/backups/${fileName}"`,
    ],
    { DUMP_URL: url },
  );
  if (dump.status !== 0) {
    throw new Error(`pg_dump failed:\n${dump.stderr.trim()}`);
  }

  // A readable archive lists its contents; an empty or corrupt file doesn't.
  const list = docker([
    "run",
    "--rm",
    "-v",
    `${BACKUP_DIR}:/backups`,
    IMAGE,
    "pg_restore",
    "--list",
    `/backups/${fileName}`,
  ]);
  const entries = list.stdout
    .split("\n")
    .filter((line) => line && !line.startsWith(";")).length;
  if (list.status !== 0 || entries === 0) {
    throw new Error(
      `The backup file isn't a readable archive:\n${list.stderr.trim()}`,
    );
  }

  const path = `${BACKUP_DIR}/${fileName}`;
  const kb = Math.ceil(statSync(path).size / 1024);
  console.log(
    `Backed up ${describeDatabase(url)} → backups/${fileName} (${kb} KB, ${entries} archive entries)`,
  );
  console.log("Copy it somewhere off this laptop, encrypted (docs/BACKUP.md).");
  return path;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    backupDatabase(process.env.DATABASE_URL_DIRECT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
