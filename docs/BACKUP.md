# Backups and restores

**For:** the owner, running these on a Windows laptop with Docker Desktop.

**Status:**
- The procedure is approved (2026-10-13).
- The `npm run db:backup`, `db:restore-check` and `db:migrate:prod` scripts exist (built in M2, before the first production deploy) and were tested end to end against the local database.
- The manual commands below still work if you ever need them without the scripts.

---

## Why this exists

- **Neon Free is the only copy of our logs.**
- Neon Free keeps about **6 hours** of history (capped at 1 GB of changes). That helps undo a mistake made in the last few hours, but it isn't a backup.
- A backup is a `pg_dump` file of the whole production database, kept on the laptop and in a second place.

**Backups contain health data** (check-ins, body weight, health-screen answers).
- Never commit them.
- Never share them.
- Encrypt any copy that leaves the laptop.

---

## Schedule

| When | Who | How |
|---|---|---|
| Every Sunday evening | Owner | `npm run db:backup` |
| Before every production migration | Automatic | `npm run db:migrate:prod -- --yes` takes a backup first and stops if that fails (without `--yes` it only prints the target) |
| Fri 20 Nov 2026 (day before race) and the Monday after the race | Owner | `npm run db:backup` |
| Monthly, and right after the first ever backup | Owner | `npm run db:restore-check` (see below) |

**Retention:** keep every backup until a month after the race, then keep the last 4 weekly ones. Each file is small (MBs).

---

## One-time setup (M2, when the database exists)

1. **Docker Desktop** must be running. The tools run inside the official `postgres:18` image, so nothing needs installing on Windows.
2. **Create `.env.prod.local`** in the repo root. It's git-ignored and holds only:
   ```
   DATABASE_URL_DIRECT=postgresql://…   # Neon console → Connect → turn OFF "Connection pooling"
   ```
   Use the **direct** string (no `-pooler` in the host). Neon says the pooled connection must not be used for dumps.

---

## Take a backup

```
npm run db:backup
```

This writes `backups/yoddha-prod-YYYYMMDD-HHMM.dump` (Postgres custom format, whole database) and prints the file size.

**Manual equivalent (PowerShell)**, which also works before the script exists:

```powershell
$url = "<Neon direct connection string>"
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
docker run --rm -v "${PWD}\backups:/backups" postgres:18 `
  pg_dump $url --format=custom --no-owner --no-privileges `
  --file "/backups/yoddha-prod-$stamp.dump"
```

---

## Keep a second copy

- **First copy:** `backups/` on the laptop (git-ignored).
- **Second copy:** copy each new file to an external drive or personal cloud storage, **encrypted**. For example:
  - 7-Zip → Add to archive → Encryption: AES-256, with a strong password kept in a password manager.
  - Or a BitLocker-encrypted drive.

---

## Check that a backup restores (monthly)

A backup you haven't restored isn't proven.

```
npm run db:restore-check -- backups/<file>.dump
```

This restores into a throwaway `yoddha_restore_check` database in the **local** Docker Postgres, prints row counts for the main log tables, then drops it. Production is never touched.

**Manual equivalent** (local container service `db`, user `yoddha`, from M1's `docker-compose.yml`):

```
docker compose up -d db
docker compose exec db dropdb -U yoddha --if-exists yoddha_restore_check
docker compose exec db createdb -U yoddha yoddha_restore_check
docker compose cp backups/<file>.dump db:/tmp/restore.dump
docker compose exec db pg_restore -U yoddha --no-owner --no-privileges -d yoddha_restore_check /tmp/restore.dump
docker compose exec db psql -U yoddha -d yoddha_restore_check -c "select count(*) from workout_log"
docker compose exec db dropdb -U yoddha yoddha_restore_check
```

The restore worked if `pg_restore` reports no errors and the counts look right.

---

## Restore production (only if data is lost or corrupted)

1. **Pause logging.** Tell both athletes not to log until you say so.
2. **Back up the current state first** (`npm run db:backup`), even if it's broken.
3. **If the damage happened within the last ~6 hours,** check the Neon console's restore option on the production branch first. It may be faster and lose less.
4. **Otherwise, restore the latest good dump into a new, empty Neon database:**
   1. Neon console → production branch → create database `yoddha_restored`, then copy its **direct** connection string.
   2. Run:
      ```powershell
      docker run --rm -v "${PWD}\backups:/backups" postgres:18 `
        pg_restore --no-owner --no-privileges -d "<direct URL of yoddha_restored>" /backups/<file>.dump
      ```
   3. In Vercel → Project → Settings → Environment Variables (Production), point `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` at `yoddha_restored`, then redeploy.
5. **Check the app:** sign in as both athletes and look at recent logs. Then resume logging.
6. **Clean up:** after a week, delete the broken database.

Anything logged after the backup was taken is lost and has to be re-entered. That's why the backups are weekly and taken before every migration.

---

## Not yet built

A per-user JSON export ("download my data") is an optional M10 item. The backups above protect the data until then.
