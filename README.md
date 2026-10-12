# Yoddha Prep

A private training, nutrition and recovery tracker for two athletes preparing for the Yoddha Race (Men's Doubles, Mumbai, 21–22 Nov 2026).

**Status:** M1 (scaffold) is done. Nothing is deployed yet; the first production deploy happens at the end of M2.

## Docs

| Doc | What it covers |
|---|---|
| [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | What we're building and how we work |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Approved architecture: stack, schema, authorization, deployment, milestone plan |
| [docs/IMPORT_FORMAT.md](docs/IMPORT_FORMAT.md) | The JSON format for importing training and nutrition plans |
| [docs/BACKUP.md](docs/BACKUP.md) | Backups, restore checks, disaster restore |
| [CLAUDE.md](CLAUDE.md) | Working rules for AI-assisted development in this repo |

## Prerequisites

- **Node.js 24.x** (with npm 11)
- **Docker Desktop**, for the local Postgres 18 database

## Local setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create your local env file. The database values work as they are; the auth values are needed from M2.
   ```
   cp .env.example .env.local                 # Git Bash
   Copy-Item .env.example .env.local          # PowerShell
   ```
3. Start Postgres. It runs on `localhost:5433`, with a dev database (`yoddha_dev`) and a test database (`yoddha_test`).
   ```
   npm run db:up
   ```
4. Start the app, then open http://localhost:3000.
   ```
   npm run dev
   ```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run lint` / `lint:fix` | ESLint, including the architecture's import and date rules. Warnings fail the run. |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:watch` | Unit tests (Vitest) |
| `npm run test:integration` | Database-backed tests against `yoddha_test` (from M2; needs `npm run db:up`) |
| `npm run test:all` | Both test projects |
| `npm run db:up` / `db:down` | Start / stop local Postgres (`db:down` keeps the data) |
| `npm run db:psql` | psql shell into the dev database |

## Still to come

These sections get filled in as the milestones land:

- **Environment variables:** see `.env.example` for now. The full reference arrives in M2.
- **Database schema and migrations:** M2.
- **Deploying (Vercel + Neon):** M2.
- **Adding the partner's account:** M3.
- **Backups:** see [docs/BACKUP.md](docs/BACKUP.md); the scripts arrive in M2.
