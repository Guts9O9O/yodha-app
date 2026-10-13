# Yoddha Prep

Training/nutrition tracker for two athletes (Yoddha Race, Men's Doubles, Mumbai, 21–22 Nov 2026).
Read before working: `docs/PROJECT_BRIEF.md` (requirements and rules), `docs/ARCHITECTURE.md` (approved
stack, schema, authz, batch plan), `docs/IMPORT_FORMAT.md` (plan JSON spec), `docs/BACKUP.md`.

## Standing rules
- JavaScript only, no TypeScript. JSDoc types are fine.
- Batches of 2–3 related files. After each batch: explain what/why, run lint + relevant tests and
  report results, list manual checks for the owner, commit. Stop for owner review at each milestone end.
- Git: one branch per milestone (`m1-scaffold`, `m2-backend`, …), merged to `main` at review.
  Vercel deploys production from `main`. Commit subjects like "M1.3: <what>".
- Verify versions and APIs in official docs before using them; don't rely on memory. Next.js docs for
  the installed version ship in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- No fake data. Honest empty states. Seeds: only race reference data + approved benchmark types.
  Plans, foods, prices enter only via import (IMPORT_FORMAT.md) or user entry.
  Never invent food composition values; every food revision has `source` + `isEstimate`.
- Ask first before: a paid service, a major dependency, or any change to the approved data model.
- Never commit secrets (`.env*.local`, `backups/`). Keep `.env.example` current.

## Hard technical rules
- Dates: plan/log days are `'YYYY-MM-DD'` strings end to end (Drizzle `date` string mode). Use
  `src/lib/dates.js`; never `new Date('YYYY-MM-DD')` elsewhere. App TZ Asia/Kolkata; timestamps UTC.
- Authorization is server-side only. DB access only via `src/server/dal/*`; every DAL function takes
  the viewer; scope in SQL. Never accept user/athlete IDs from the client for ownership. Every Server
  Action re-checks auth. `proxy.js` is UX only. No auth checks in layouts.
- `'use cache'` only for non-user data (race reference). Never in viewer-scoped code.
- Zod 4 on every server input; `z.strictObject` for imports and action inputs.
- Drizzle 0.45 core query builder only (no relational queries). No raw `pool.query` in app code.
- Better Auth ≥ 1.7.7, Google only, no plugins. Allowlist via `ALLOWED_EMAILS`.
- Next.js: bump to the patched 16.4.x release before the first deploy (M2 gate).

## Commands (keep in sync with package.json)
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` (warnings fail) / `npm run lint:fix` / `npm run format` / `npm run format:check`
- `npm test` (unit) / `npm run test:integration` (needs `npm run db:up`) / `npm run test:all`
- `npm run db:up` / `npm run db:down` / `npm run db:psql` — Docker Postgres 18 on localhost:5433,
  databases `yoddha_dev` and `yoddha_test`
- `npm run db:generate` (drizzle-kit → `drizzle/`; review the SQL) / `npm run db:migrate` (dev DB;
  integration tests migrate `yoddha_test` themselves). Don't use `drizzle-kit export`: it ignores casing.
- `npm run auth:generate` regenerates `src/server/db/schema/auth.js` (never hand-edit it)
- `npm run db:backup` / `db:restore-check -- <file>` / `db:migrate:prod -- --yes` (prod via `.env.prod.local`;
  see docs/BACKUP.md). Planned: `db:seed` (M3/M4), `import-schema` (M2)

## Layout
`src/app` routes (thin) · `src/features/<domain>` UI + server actions · `src/lib` pure logic
(unit-tested) · `src/schemas` Zod · `src/server` server-only (db, auth, authz, dal, import, seed) ·
`tests/integration` DB-backed tests · `drizzle/` migrations (committed, reviewed).
