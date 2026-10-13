# Yoddha Prep — Architecture Proposal (M0)

Status: **APPROVED by the owner on 2026-10-13**, with the decisions recorded in §0 and §11.
- Requirements: [PROJECT_BRIEF.md](PROJECT_BRIEF.md).
- Plan JSON format: [IMPORT_FORMAT.md](IMPORT_FORMAT.md), which is authoritative for the file format.
- Backups: [BACKUP.md](BACKUP.md).
- Library versions were checked against official sources on 2026-10-13.
- Any change to the data model below needs the owner's approval first.

---

## 0. Approved decisions (2026-10-13)

| # | Decision | Outcome | Section |
|---|---|---|---|
| D1 | Timeline (the race is 39 days away, on 21 Nov) | **First production deploy at the end of M2.** A basic "today" view at the end of M5. If time slips, keep logging (workouts, check-ins, benchmarks, meals), plan views and race pages; simplify or drop analytics charts (M8) and advanced partner views (M9) first. | §9 |
| D2 | ORM | **Drizzle 0.45** (stable), core query builder only | §1 |
| D3 | Auth library | **Better Auth ≥ 1.7.7**, Google only, `ALLOWED_EMAILS` allowlist, no plugins | §1, §4 |
| D4 | Hosting | **Vercel Hobby + Neon Free, both in Singapore** | §8 |
| D5 | Food composition | **Immutable revisions** (`food` + `food_revision`) | §2.6 |
| D6 | Import format | `planKey`, `eventCategory`, `lighterOption`, `gramsPerUnit`, `null` instead of `0`, specified in full in IMPORT_FORMAT.md | §5.6 |
| D7 | Import permissions | Each athlete imports **their own** nutrition plan. A **team** training plan can be imported by either team member. An individual training plan is imported by its athlete. | §4.4 |
| D8 | Exercise categories | Station categories are validated against the seeded station keys, not hardcoded | §5.6 |
| D9 | Race entry | A `race_entry` table holds the wave date/time and bib. The `medal` goal type uses `event_category.medal_cutoff_sec`. | §2.2, §2.3 |
| D10 | UI primitives | **shadcn/ui in JavaScript mode**, approved | §1 |
| D11 | Costs | Unpriced items make a day's cost "incomplete"; costs are rounded up | §5.4 |
| D12 | Next.js | Pin the patched 16.4.x release (announced for 2026-10-14). It wasn't published on 2026-10-13, so M1 scaffolds on 16.4.0, and **the bump is a hard gate before the first deploy (M2)**. | §1, §9 |
| D13 | Git | `main` + a private GitHub repo. One branch per milestone (`m1-scaffold`, …), merged to `main` at each milestone review. Vercel deploys production from `main`. | §8.4 |

---

## 1. Stack

Versions were checked on 2026-10-13 against npm and official docs. Exact versions get pinned in `package.json` in M1.

| Layer | Choice | Version | Why |
|---|---|---|---|
| Runtime | Node.js | **24.x LTS** | Vercel's default (it offers only 24.x and 22.x). Vitest 5 needs ≥ 22.12. Node 26 becomes LTS on 28 Oct, but Vercel doesn't offer it yet. |
| Framework | Next.js App Router, JavaScript | **16.4.x**: scaffold on 16.4.0, then pin the **security patch release announced for 2026-10-14** (2 critical + 1 high upstream vulnerabilities) **before the first deploy** (D12) | Server Components for reads, Server Actions for writes, `proxy.js` (formerly middleware). `create-next-app --js` is still supported. Turbopack is the default. |
| React | React | **19.3** (bundled) | `useActionState` for forms, `useOptimistic` for one-tap logging. No form or data-fetching library needed. |
| Caching model | `cacheComponents: true` | default in 16.4 `create-next-app`, and the default for all apps in Next 17 | Staying on the default avoids a migration later. Per-user pages stream inside `<Suspense>` with skeletons. `'use cache'` only for race reference data (§4.2). |
| Database | PostgreSQL | **18** (Docker `postgres:18` locally; Neon PG18 is GA) | Real `date`/`time` types, CHECK constraints, partial unique indexes, `NULLS NOT DISTINCT`, built-in `uuidv7()`. |
| ORM | **Drizzle ORM** + drizzle-kit | **0.45.4 / 0.31.11** (stable) | See "Why Drizzle" below. |
| DB driver | `pg` (node-postgres) + `@vercel/functions` `attachDatabasePool` | pg 8.x | Neon's recommendation for Vercel Fluid compute is a TCP driver plus a pool. The same driver runs locally against Docker, so dev and prod don't diverge. Transactions work (the import commit needs them). |
| Auth | **Better Auth** + `@better-auth/drizzle-adapter` | **≥ 1.7.7** (required: earlier versions have a critical advisory) | See "Why Better Auth" below. |
| Validation | Zod | **4.6.x** | `z.strictObject` rejects unknown keys in imports; `z.iso.date()` validates `YYYY-MM-DD`. Zod 4 can also emit JSON Schema for the import format (to confirm in M2). |
| Styling | Tailwind CSS | **4.3.x** (`@tailwindcss/postcss`, CSS-first `@theme` tokens) | Dark design tokens defined once in CSS. |
| UI primitives | shadcn/ui, **JavaScript mode** (`tsx: false`) | CLI 4.21; Base UI primitives (its default since July 2026) | Accessible sheets, dialogs, tabs and selects copied into the repo as `.jsx`. Approved (D10). |
| Charts | Recharts | **3.10.x** (+ matching `react-is`) | React 19 support. Imported only from Client Components (it ships no `"use client"`). |
| Unit/integration tests | Vitest | **5.0.x** | Two projects: `unit` (parallel) and `integration` (serial, real Postgres). |
| E2E | Playwright | **1.64.x** | M10 smoke tests. |
| Lint/format | ESLint flat config (`eslint-config-next/core-web-vitals`) + Prettier 3.9 + `eslint-config-prettier` | ESLint major = whatever `create-next-app` 16.4 installs (eslint-config-next supports 9 and 10) | `next lint` was removed in Next 16, so we use the ESLint CLI directly. |
| Dates | **no library**: one tested `src/lib/dates.js` | — | Every date op is string-in/string-out; see §6. |

**Why Drizzle over Prisma** (for a JavaScript project with these requirements):
1. **Date-only safety.**
   - Drizzle's `date()` returns `'YYYY-MM-DD'` strings by default (`mode: 'string'`), and its node-postgres session turns off `pg`'s local-time date parsing.
   - Prisma maps `@db.Date` to a JS `Date` at UTC midnight. The "dates shift by a day" issue (#7490) has been open since 2021 and is still unresolved in Prisma 7.
   - The brief's hardest rule is "dates must never shift", so this decides it.
2. **Constraints in the schema file.**
   - Drizzle's `check()`, partial `uniqueIndex().where()` and `.nullsNotDistinct()` all generate SQL migrations.
   - Prisma doesn't support CHECK constraints at all ("not yet"); you hand-edit migration SQL. Its partial indexes are a preview feature.
   - This schema relies on about 30 such constraints (§2).
3. **Plain JavaScript.**
   - A Drizzle schema is ordinary `.js` with no codegen step.
   - Prisma 7's current generator emits **only TypeScript** files, and its JS generator is deprecated.
4. **SQL-shaped queries.** Authorization scoping (`where athlete_id in (…)`) stays visible in every query.

*Caveat:*
- Drizzle 1.0 is at release candidate (rc.4), and the docs site now describes v1.
- We use the **stable 0.45.4** (approved), with only the core query builder (`select/insert/update` + `where`), not relational queries. That part of the API is the same in both versions.
- Upgrade to 1.0 after it goes GA (`drizzle-kit up` converts the migrations folder).

**Why Better Auth over Auth.js:**
- Auth.js v5 is **still beta** (`5.0.0-beta.32`).
- Since Sept 2025, Auth.js is "part of Better Auth", and its maintainers "strongly recommend new projects start with Better Auth".
- Better Auth gives us:
  - Database sessions by default (revocable).
  - Database hooks to enforce the allowlist.
  - A first-party Drizzle adapter.
  - Documented Next.js 16 `proxy` guidance.
- *Caveat:* Better Auth has had a steady stream of security advisories, mostly in optional plugins. Mitigation:
  - Pin ≥ 1.7.7.
  - Install **no plugins**.
  - Check the advisories page before each milestone.
- Hosted auth (Clerk etc.) was not considered: it's a paid service and not needed for two users.

**Not adding:** a date library, a form library, a client data-fetching library, a state manager, or an error-tracking SaaS. Each can be revisited if a real need appears, and I'll ask first.

---

## 2. Database schema

### 2.1 Conventions

- **Naming:** `snake_case` tables and columns in SQL, `camelCase` in JS (Drizzle `casing: 'snake_case'`).
- **Keys:** app tables use `id uuid primary key default uuidv7()` (built into Postgres 18; time-ordered, so indexes stay compact). Auth tables use Better Auth's text IDs. Domain tables reference `athlete_profile.id`, not `user.id`, so auth stays decoupled from domain data.
- **Time types:**
  - Date-only (plan days, log days, rule dates) → `date`, read and written as `'YYYY-MM-DD'` strings (Drizzle `mode: 'string'`). Never a JS `Date`.
  - Wall-clock times (meal time, bed time, wave time) → `time`, as `'HH:MM'` strings, meaning Asia/Kolkata local time.
  - Instants (`created_at`, `approved_at` …) → `timestamptz` (UTC).
- **Numbers:**
  - Grams, kg and nutrient values → `numeric` with an explicit scale.
  - Money → `numeric(10,2)` INR.
  - Counts → `smallint` or `integer`.
  - Durations → **seconds** (`integer`), including goal target times.
- **Timestamps:** every mutable table has `created_at` and `updated_at` (`updated_at` is set by the app on every update; the brief requires it for logs).
- **Indexes:** every FK column is indexed (Postgres doesn't do this automatically). These aren't listed below unless they're composite.
- **Closed sets** (statuses, meal types, diet tags) are Postgres enums. Changes go through migrations.
- **Delete rules:**
  - Plan content cascades from `plan_version`, so a draft with no logs can be deleted.
  - Logs point at plan content with `ON DELETE RESTRICT`. Deleting plan content can never delete a log, and a version that has logs can't be deleted.
  - Approved and archived versions are never deleted (an app rule, with a test).
- **Display-only lists vs. computed fields:** lists that are only displayed (movement standards, warm-up steps) are `jsonb`/`text[]` and validated by Zod on the way in. Anything code computes on (station targets, switch limits, diet tags, macros) is a real column.

Constraint notation below: **PK**, **UQ** (unique), **pUQ** (partial unique), **CK** (check), **IX** (index), **XOR(a,b)** = `CHECK (num_nonnulls(a,b) = 1)`.

### 2.2 Auth and identity

**Auth tables (`user`, `session`, `account`, `verification`).**
- They're generated by the Better Auth CLI (`npm run auth:generate`, from the same options module as the app) and never hand-edited.
- Sessions are database-backed, so they can be revoked.
- IDs are `uuid`.
- *Exception to §2.1:* the generated timestamps are `timestamp` without time zone. Drizzle writes and reads them as UTC, and Better Auth sets them itself, so they stay correct as long as the database session time zone is UTC (true for the Docker image and Neon's default).

**`athlete_profile`** — one per user.
- Columns:
  - `user_id` → user.id **UQ**
  - `athlete_key` **UQ**, **CK** `~ '^[a-z][a-z0-9_]{1,30}$'`, immutable after creation (imports and `per_athlete` JSON reference it)
  - `display_name`
  - `date_of_birth date?`, `sex enum?`, `height_cm numeric(4,1)?` **CK** 100–250
  - `training_experience enum?`
  - `availability_days smallint[]` (0–6), `availability_start_time time?`, `availability_max_minutes smallint?`
  - `timezone text default 'Asia/Kolkata'`
  - `onboarding_completed_at timestamptz?`

**`onboarding_response`** — raw structured answers, kept for future plan generation.
- Columns:
  - `athlete_id`
  - `question_set_key`, `question_set_version smallint`
  - `section enum(profile, goal, health, sleep, diet, cooking, partner)`
  - `answers jsonb`
  - `health_flag bool` (true when any health-screen answer is "yes", which shows the banner)
  - `completed_at?`
- Constraints: **UQ**(athlete_id, question_set_key, question_set_version, section).
- **Always owner-only, including the health screen.** No sharing category covers this table.
- On completion, answers are copied into their structured homes (profile, `goal`, `diet_rule`, availability). The question definitions live in versioned code (`questions-v1.js`).

**`team`** — columns: `name`, `created_by_athlete_id`.

**`team_member`** — columns: `team_id`, `athlete_id`, `role enum(owner, member)`, `joined_at`.
- **PK**(team_id, athlete_id), **IX**(athlete_id).
- App rule: a team can't have more members than its race entry's `team_size`.

**`team_invite`**
- Columns: `team_id`, `token_hash` **UQ**, `created_by_athlete_id`, `expires_at`, `accepted_by_athlete_id?`, `accepted_at?`, `revoked_at?`.
- The link carries a random token; only its SHA-256 is stored. The invitee must also be on the allowlist.

**`sharing_setting`** — columns: `athlete_id`, `category enum(training, benchmarks, nutrition, body_weight, checkins)`, `visible_to_team bool`.
- **PK**(athlete_id, category).
- A missing row means the default (§4.3).

**`goal`**
- Columns:
  - `athlete_id?`, `team_id?` — **XOR**
  - `event_category_id`
  - `goal_type enum(finish, medal, podium, time_target)`
  - `target_time_min_sec?`, `target_time_max_sec?`
  - `notes`, `is_active bool`
- Constraints:
  - **CK** min ≤ max.
  - **CK** `time_target` ⇒ at least one target.
  - **pUQ**(athlete_id, event_category_id) WHERE is_active. The same applies for team.
- `medal` replaces the brief's `medal_sub90`. The cut-off comes from `event_category.medal_cutoff_sec`, so the goal type isn't Yoddha-specific.

### 2.3 Race reference

**`event`**
- Columns: `key` **UQ** (e.g. `yoddha_s3_mumbai_2026`), `name`, `series`, `season`, `city`, `start_date`, `end_date`, `timezone`, `source_urls text[]`, `verified_at date`, `reverify_note`.
- **CK** end ≥ start.

**`event_category`**
- Columns: `event_id`, `key` (e.g. `mens_doubles`), `name`, `team_size smallint`, `run_segment_m int`, `run_segment_count smallint`, `medal_cutoff_sec int?`, `load_reference text?` ("Loads identical to Male Open"), `notes`.
- **UQ**(event_id, key).

**`station`**
- Columns:
  - `event_category_id`, `position smallint`, `key`, `name`
  - `metric enum(distance_m, reps)`, `target numeric`
  - `load_kg numeric?`, `load_spec text` (e.g. "2 × 24 kg"), `equipment_spec text`
  - `movement_standards jsonb` (string list)
  - `switch_mode enum(max_switches, free, swap_zone_only)`, `max_switches smallint?`
  - `partner_position text`, `doubles_notes text`
  - `faults jsonb` (list of `{fault, penalty: plus_minutes|dnf|dq|no_rep|restart|judge, minutes?}`)
- Constraints:
  - **UQ**(event_category_id, key), **UQ**(event_category_id, position).
  - **CK** `switch_mode = 'max_switches'` ⇔ `max_switches IS NOT NULL`.

**`rule_note`** — covers general rules, penalties, kit, hydration and the 7 unresolved items.
- Columns:
  - `event_id`, `event_category_id?`, `station_id?`
  - `key`, `topic enum(format, general, penalty, kit, hydration, station, logistics)`
  - `title`, `body`
  - `status enum(verified, unconfirmed, contradictory)`
  - `working_assumption text?` (e.g. "Assume Concept2 damper 7")
  - `source_url?`, `verified_at date?`, `position`
- **UQ**(event_id, key).

**`race_entry`** *(new)* — a team's or athlete's registration in an event category.
- Columns: `event_category_id`, `team_id?`, `athlete_id?` (**XOR**), `wave_date date?`, `wave_time time?`, `reporting_time time?`, `bib?`, `notes`.
- **pUQ**(team_id, event_category_id) and **pUQ**(athlete_id, event_category_id).
- This replaces "Team links to an event category". A team is just the pair, so the same pair can enter future events.
- The countdown targets `wave_date` once it's known, and the event's `start_date` with "wave day TBC" before then.

**Seed** (M4) is an idempotent upsert by keys from one data file. It stores `verified_at = 2026-10-12` and the three source URLs.

**Seed data allowed:** this race reference data, plus the owner-approved **built-in benchmark type definitions** (§2.5). Those are definitions, not measurements. Nothing else is seeded.

### 2.4 Plans and imports

**`plan`**
- Columns:
  - `kind enum(training, nutrition)`, `plan_key`, `title`
  - `owner_athlete_id?`, `owner_team_id?` — **XOR**
  - `event_category_id?` (context used to resolve `stationKey`)
  - `created_by_athlete_id`
- Constraints:
  - **CK** `kind = 'nutrition'` ⇒ athlete owner.
  - **UQ NULLS NOT DISTINCT**(kind, owner_athlete_id, owner_team_id, plan_key).

**`plan_import`** *(new)* — a staging and audit row for every upload, including rejected ones.
- Columns:
  - `imported_by_athlete_id`, `kind`, `schema_version smallint`
  - `raw_text text` (exact bytes as uploaded; `jsonb` would reorder keys and drop duplicates)
  - `sha256`
  - `status enum(previewed, committed, rejected, expired)`
  - `report jsonb` (errors, warnings, summary)
  - `plan_version_id?`, `created_at`, `committed_at?`
- **IX**(imported_by_athlete_id, created_at desc), **IX**(sha256).

**`plan_version`**
- Columns:
  - `plan_id`, `version_number int`
  - `status enum(draft, approved, archived)`, `version_note`
  - `start_date`, `end_date`, `assumptions text[]`
  - `budget_inr_per_day numeric(10,2)?` (nutrition only)
  - `import_id` **UQ** → plan_import
  - `created_by_athlete_id`, `imported_at`
  - `approved_at?`, `approved_by_athlete_id?`, `archived_at?`
- Constraints:
  - **UQ**(plan_id, version_number).
  - **pUQ**(plan_id) WHERE status = 'approved' (at most one live version per plan).
  - **CK** end ≥ start; **CK** approved ⇒ approved_at set.
- **IX**(status, start_date, end_date).

**`plan_version_athlete`** *(new)* — which athletes a version covers.
- **PK**(plan_version_id, athlete_id), **IX**(athlete_id).
- Makes "approved content for athlete X on date D" a simple join.

### 2.5 Training

**`training_session`**
- Columns:
  - `plan_version_id` (cascade), `date`, `position smallint` (several sessions per day)
  - `type enum(run, strength, station, combo, mobility, rest, test)`
  - `title`, `objective`, `estimated_minutes?`, `joint bool`
  - `warmup text[]`, `cooldown text[]`, `recovery`, `stop_criteria text[]`
  - `lighter_option text?` *(new; the low-sleep feature needs it)*
- **UQ**(plan_version_id, date, position), **IX**(plan_version_id, date).

**`session_athlete`**
- Columns: `session_id` (cascade), `athlete_id`.
- **PK** on both; **IX**(athlete_id).

**`session_block`**
- Columns: `session_id` (cascade), `position`, `name`.
- **UQ**(session_id, position).

**`exercise_prescription`**
- Columns:
  - `block_id` (cascade), `position`, `name`, `category text`
  - `station_id?` → station (resolved from `stationKey`)
  - `sets`, `reps`, `distance_m`, `duration_sec`, `load_kg`, `load_guidance`, `rest_sec`
  - `target_rpe text` (as written, e.g. "3-4"), `target_rpe_low smallint?`, `target_rpe_high smallint?` (parsed, for analytics)
  - `notes`, `per_athlete jsonb` (keyed by athleteKey; values are overrides with the same shape as the exercise, per IMPORT_FORMAT.md §3.3)
- Constraints: **UQ**(block_id, position); **CK** positive numbers; **CK** RPE between 1 and 10 with low ≤ high.

**`workout_log`**
- Columns:
  - `athlete_id`, `date`
  - `session_id?` → training_session **RESTRICT**
  - `status enum(completed, partial, skipped)`
  - `actual_minutes?`, `session_rpe smallint?` **CK** 1–10, `notes`
- **pUQ**(athlete_id, session_id) WHERE session_id IS NOT NULL. This gives one log per planned session per athlete and makes double-taps idempotent.
- **IX**(athlete_id, date).

**`set_log`**
- Columns:
  - `workout_log_id` (cascade)
  - `prescription_id?` **RESTRICT**
  - `exercise_position smallint`, `exercise_name`
  - `category text` *(new; needed to compute run km for unplanned runs)*
  - `set_number`, `reps`, `load_kg`, `distance_m`, `duration_sec`, `rpe?`
- **UQ**(workout_log_id, exercise_position, set_number).

**`benchmark_type`** *(new)*
- Columns:
  - `key`, `name`, `unit`
  - `value_kind enum(time_sec, distance_m, reps, load_kg, other)`, `better enum(lower, higher)`
  - `station_id?`, `event_category_id?`
  - `owner_athlete_id?` (null = built-in; set = that athlete's custom type)
- **UQ NULLS NOT DISTINCT**(owner_athlete_id, key).
- **Built-in list (approved 2026-10-13):**
  - **M3 seeds:** `run_700m`, `run_1km`, `run_5km`. All are time, lower is better.
  - **M4 seeds** (alongside the race seed; these reference the event category and its stations):
    - One per station at race spec (time, lower is better), with keys `station_row`, `station_sled_push`, `station_sled_pull`, `station_kb_carry`, `station_box_jump`, `station_lunge`, `station_wall_ball`. Names come from the station spec, e.g. "Row 1,000 m @ Resistance 7".
    - `sim_half` and `sim_full` (half- and full-race sim, time).
  - **Custom:** athletes can add their own types at any time.

**`benchmark`**
- Columns: `athlete_id`, `benchmark_type_id`, `date`, `value numeric`, `unit`, `effort enum(easy, moderate, max, unknown) NOT NULL` (every benchmark records effort; `unknown` is an explicit choice), `conditions`, `notes`.
- **IX**(athlete_id, benchmark_type_id, date).

### 2.6 Nutrition

**`diet_rule`**
- Columns:
  - `athlete_id`
  - `kind enum(weekday, date_range)`, `weekday smallint?`, `start_date?`, `end_date?`
  - `restriction enum(vegetarian)`
  - `eggs_allowed bool?` (null = pending, treated as not allowed)
  - `excluded_items text[]`, `note`, `archived_at?`
- **CK**: either (weekday rule with `weekday` between 0 and 6 and no dates) or (date-range rule with no weekday and `end_date ≥ start_date`).
- **Weekday convention: 0 = Sunday … 6 = Saturday** (JS `getUTCDay`). Chinmay's Monday is 1 and Thursday is 4.

**`food`** — identity only.
- Columns: `key` **UQ** (slug **CK**), `created_at`.

**`food_revision`** *(new; immutable composition)*
- Columns:
  - `food_id`, `revision int`, `name`
  - `diet_tag enum(veg, egg, chicken, fish, other_meat)`
  - Per 100 g: `kcal`, `protein_g`, `carbs_g`, `fat_g` (`numeric NOT NULL`, **CK** ≥ 0), and `fibre_g` (`numeric`, **nullable** = unknown, **CK** ≥ 0)
  - `household_measures jsonb`
  - `source text NOT NULL` **CK** non-blank, `is_estimate bool NOT NULL`
  - `content_hash`, `created_by_import_id?`
- **UQ**(food_id, revision), **UQ**(food_id, content_hash).
- Import behaviour for a food key:
  - Identical values → reuse the existing revision.
  - Different values → create a new revision and show a diff in the preview.
- Planned items and logged items point at a specific **revision**, so history never changes.

**`food_price`**
- Columns:
  - `food_id`, `price_inr numeric(10,2)`, `per_qty numeric`
  - `unit enum(g, kg, ml, l, piece)`, `grams_per_unit numeric?`
  - `as_of date`, `source`, `is_estimate`, `import_id?`
  - `exclude_from_budget bool NOT NULL default false` *(owner request, 2026-10-13: already-paid items still show their cost but aren't counted against the daily budget)*
- **CK** `unit IN ('g','kg') OR grams_per_unit > 0`. Cost has to resolve to grams.
- **UQ**(food_id, as_of, source), **IX**(food_id, as_of desc).

**`nutrition_target`**
- Columns:
  - `athlete_id`, `plan_version_id?` (cascade), `effective_from date`
  - Min/max pairs for kcal (required, min > 0) and for protein, carbs, fat and fibre (each pair nullable)
  - `fluid_note`, `rationale`
- Constraints: **CK** each min ≤ max; **CK** each pair is both-null or both-set; **pUQ**(plan_version_id).
- **IX**(athlete_id, effective_from).
- Target for date D: the target of the approved nutrition version that covers D. If there isn't one, the latest manual target (no version) with `effective_from ≤ D`.

**`meal_plan_day`**
- Columns: `plan_version_id` (cascade), `athlete_id`, `date`, plus nullable `expected_kcal … expected_cost_inr`.
- **UQ**(plan_version_id, date), **IX**(athlete_id, date).

**`planned_meal`**
- Columns: `meal_plan_day_id` (cascade), `position`, `type enum(breakfast, lunch, pre_workout, post_workout, dinner, snack)`, `time time?`, `name`, `prep`, `substitutions text[]`.
- **UQ**(meal_plan_day_id, position).

**`planned_meal_item`**
- Columns: `planned_meal_id` (cascade), `position`, `food_revision_id` **RESTRICT**, `grams numeric` **CK** > 0, `household`.
- **UQ**(planned_meal_id, position).

**`meal_log`**
- Columns: `athlete_id`, `date`, `meal_type`, `planned_meal_id?` **RESTRICT**, `notes`.
- **pUQ**(athlete_id, planned_meal_id) WHERE planned_meal_id IS NOT NULL. This makes one-tap "ate as planned" idempotent.
- **IX**(athlete_id, date).

**`meal_log_item`**
- Columns: `meal_log_id` (cascade), `food_revision_id` **RESTRICT**, `planned_item_id?`, `grams` **CK** > 0.

### 2.7 Recovery and team

**`daily_checkin`**
- Columns:
  - `athlete_id`, `date`
  - Sleep: `sleep_hours numeric(3,1)` **CK** 0–24, `bed_time time?`, `wake_time time?`, `sleep_quality` **CK** 1–5
  - Body: `soreness` **CK** 1–10, `soreness_areas text[]`, `energy` **CK** 1–5, `fluid_l`, `body_weight_kg` (sanity **CK**), `resting_hr` (sanity **CK**)
  - `red_flags enum[]` (chest_pain, fainting, dizziness, palpitations, breathlessness, sharp_pain), `notes`
- **UQ**(athlete_id, date).
- `body_weight_kg` follows the `body_weight` sharing category, not `checkins`. The partner's view masks it field by field.

**`checklist_item`**
- Columns:
  - `team_id?`, `athlete_id?` — **XOR**
  - `race_entry_id?`, `title`, `category enum(kit, admin, race_week, race_day)`
  - `due_date?`, `done bool`, `done_at?`, `done_by_athlete_id?`, `position`
  - `is_private bool default false`
- **CK** `NOT is_private OR athlete_id IS NOT NULL` (only individual items can be private).
- **Visibility:**
  - Team items are visible to the team.
  - Individual items are visible to the partner by default, unless the owner sets that item to private.
- No seeded items. A button can add suggested items derived from the seeded kit rules, but only when the user clicks it.

**`station_split`**
- Columns:
  - `race_entry_id`, `station_id`
  - `segments jsonb` (list of `{athleteKey, amount, atSwapZone}`)
  - `plan_text`, `notes`, `updated_by_athlete_id`
- **UQ**(race_entry_id, station_id).
- Validated against the station's structured rules (§5.5).

### 2.8 Computed, not stored

These are computed on read by pure functions in `src/lib`. The data is tiny (2 athletes, about 40 days), so v1 has no cache and no invalidation.
- Daily nutrition totals and cost.
- Totals vs. expected (more than 5% off is flagged).
- Weekly load.
- Run km and longest run.
- Run-spike flags.
- Sleep averages.
- Adherence.

### 2.9 Changes vs. brief §6

New tables:
- `plan_import`
- `plan_version_athlete`
- `race_entry`
- `team_invite`
- `benchmark_type`
- `food_revision`, which splits `Food` into identity plus revisions

New fields:
- `plan.plan_key` and `plan.event_category_id`
- `training_session.position` and `training_session.lighter_option`
- `set_log.exercise_position` and `set_log.category`
- `food_price.grams_per_unit`
- `onboarding_response.section` and `onboarding_response.health_flag`
- `checklist_item.is_private`
- `benchmark_type.event_category_id`
- `food_price.exclude_from_budget`

Renamed or changed:
- `goal_type` value `medal_sub90` becomes `medal`.
- Goal times are stored in seconds.
- Raw import JSON lives in `plan_import`, not `plan_version`.
- `food_revision.fibre_g` is nullable (unknown).
- Nutrition-target macro ranges other than kcal are optional.
- `benchmark.effort` is required.

Total: 37 app tables plus 4 auth tables.

---

## 3. Folder structure

```
yoddha-prep/
├─ docs/                     PROJECT_BRIEF.md, ARCHITECTURE.md, IMPORT_FORMAT.md, BACKUP.md
│  └─ import-schema/         JSON Schema generated from the Zod import schemas (for external plan authors)
├─ docker/initdb/            init SQL for the local Postgres container (creates the test DB)
├─ drizzle/                  generated SQL migrations (committed, reviewed in every PR)
├─ e2e/                      Playwright smoke tests (M10)
├─ scripts/                  seed.js, db-backup.mjs, export-import-schema.js
├─ src/
│  ├─ app/                   routes only: thin pages that call the DAL and render feature components
│  │  ├─ (public)/sign-in/
│  │  ├─ onboarding/[step]/
│  │  ├─ (app)/              authenticated shell (bottom tab bar)
│  │  │  ├─ page.js          Today (dashboard)
│  │  │  ├─ training/        week view, [date]/, session/[id]/, session/[id]/log/
│  │  │  ├─ nutrition/       [date]/, grocery/
│  │  │  ├─ recovery/        check-in, [date]/
│  │  │  ├─ benchmarks/      [typeKey]/
│  │  │  ├─ analytics/
│  │  │  ├─ team/            splits/, checklist/, invite/[token]/
│  │  │  ├─ race/            stations/[key]/, rules/
│  │  │  ├─ plans/           import/, [planId]/, [planId]/v/[n]/
│  │  │  └─ settings/        profile/, sharing/, diet-rules/
│  │  └─ api/auth/[...all]/route.js
│  ├─ components/            ui/ (primitives), charts/ (client-only Recharts wrappers), shell/
│  ├─ features/<domain>/     domain UI components + actions.js ('use server') per domain
│  ├─ lib/                   PURE, isomorphic, no I/O: dates, units, money, nutrition math,
│  │                         diet-rule engine, training load, run spike, station-split rules
│  ├─ schemas/               Zod: forms, import v1 (training, nutrition), seed, env
│  ├─ server/                'server-only'
│  │  ├─ env.js              validated env
│  │  ├─ db/                 client.js, schema/<domain>.js, relations.js
│  │  ├─ auth/               auth.js (Better Auth config), viewer.js (getViewer/requireViewer)
│  │  ├─ authz/              policy.js (canRead/canWrite, readable athlete ids), sharing defaults
│  │  ├─ dal/<domain>.js     the ONLY code that queries the DB; every function takes a viewer
│  │  ├─ import/             parse, envelope, resolve-*, checks-*, report, commit-*
│  │  └─ seed/               race/yoddha-s3-mumbai-2026.js
│  └─ proxy.js               optimistic cookie redirect only (not a security boundary)
├─ tests/
│  ├─ integration/           DB-backed: authz matrix, IDOR, import commit, constraints
│  ├─ fixtures/imports/      valid/invalid JSON files (test-only, obviously fake, never seeded)
│  └─ helpers/               db reset/truncate, factories
├─ docker-compose.yml        postgres for dev + test databases
├─ drizzle.config.js, next.config.mjs, eslint.config.mjs, vitest.config.mjs, playwright.config.mjs
├─ .env.example, README.md, CLAUDE.md
```

Unit tests sit next to the code as `*.test.js`. Layer rules are enforced with ESLint `no-restricted-imports`:
- `app/` and `features/` may not import `server/db`.
- `lib/` may not import anything from `server/`.

---

## 4. Auth and authorization

### 4.1 Authentication

- **Provider:** Better Auth with Google (`socialProviders.google`) as the only provider. `requireEmailVerification: true` is set.
  - Email/password stays off (its default).
  - No other plugins are installed. Most of Better Auth's past advisories were in plugins (magic link, OAuth proxy, SSO), so a minimal surface is deliberate.
- **Route:** `app/api/auth/[...all]/route.js` exports `toNextJsHandler(auth)`. The Google callback URI is `{BETTER_AUTH_URL}/api/auth/callback/google`.
- **Sessions:**
  - Stored in Postgres via the Drizzle adapter. Only an opaque token is kept in an HTTP-only cookie.
  - **The cookie cache stays off**, so revoking a session takes effect immediately. One DB lookup per request is fine for 2 users.
  - Better Auth's `generateId: 'uuid'` makes auth IDs UUIDs too.
- **Allowlist (no built-in option; enforced at four points):**
  1. `databaseHooks.user.create.before` throws `APIError('FORBIDDEN', { code: 'EMAIL_NOT_ALLOWED' })` if the lowercased email isn't in `ALLOWED_EMAILS`. The `code` makes the OAuth callback redirect to the sign-in page with a readable error instead of crashing.
  2. `databaseHooks.session.create.before` runs the same check. It blocks an *existing* user whose email has been removed from the list.
  3. `getViewer()` re-checks the allowlist on every request, so a live session stops working on the next request after the env var changes.
  4. **Google OAuth app** is kept in "Testing" mode with both emails as test users, as an extra outer gate. We don't use Google refresh tokens, so the 7-day refresh-token expiry in Testing mode doesn't matter.
- **CLI gotcha:** the Better Auth CLI fails if the auth config imports `server-only`. `auth.js` stays free of it; the guard lives in `viewer.js` and the DAL.
- **`proxy.js`** only redirects requests without a session cookie to `/sign-in` for UX. **It's not a security boundary.** Every page, DAL call and action does its own check, as the Next.js docs recommend.

### 4.2 Viewer and DAL

- **Viewer:** `getViewer()` is wrapped in React `cache()`, so it runs once per request. It returns `{ userId, athleteId, athleteKey, teamIds, teammateAthleteIds }`, built only from the session.
- **No IDs from the client for ownership.** Server Actions never accept a `userId` or `athleteId` for writes; the owner is always `viewer.athleteId`. For reads of a partner's data, the client may pass a partner's `athleteKey`, and the policy decides.
- **Server Actions are public HTTP endpoints.** Each one runs `requireViewer()` → Zod-parse the input → call the DAL. Action input schemas are `z.strictObject`, so an injected `athleteId` is rejected.
- **Auth checks aren't done in layouts.** Per the Next.js docs, layouts don't re-render on navigation. Each page and action checks for itself.
- **Caching:** `'use cache'` is allowed **only** for non-user data (race reference). It's never used in a function that takes a viewer, because a cached per-user result could be served to the other athlete. This is a CLAUDE.md rule and a review checklist item.
- **The DAL scopes in SQL, never filter-after-fetch.** For example: `where athlete_id in (readableAthleteIds(viewer, 'checkins'))`.
- **Mutations by ID include ownership in the WHERE clause.** For example: `update … where id = $1 and athlete_id = $viewer returning id`. Zero rows means "not found", which doesn't reveal whether the row exists.
- **DTOs:** the DAL returns DTOs, not raw rows, so field-level rules (body weight) live in one place.

### 4.3 Sharing policy

| Data | Category | Default for partner |
|---|---|---|
| Team-owned plans, joint sessions, team checklist, station splits, team goals | (team-owned) | Always visible to team members |
| Athlete-owned training plans, workout logs, athlete goals | `training` | Shared |
| Benchmarks | `benchmarks` | Shared |
| Nutrition plans, targets, meal logs, diet rules | `nutrition` | Private |
| Body weight (field inside the check-in) | `body_weight` | Private |
| Daily check-ins (sleep, soreness, energy, red flags) | `checkins` | Private |
| Onboarding answers incl. health screen | — | **Always private, not toggleable** |
| Individual checklist items | per-item `is_private` | Shared by default; the owner can mark an item private |

Write rules:
- Athlete-owned data: only the owner can write.
- Team-owned data: any team member can write.
- A stranger (not on a shared team) can't read anything.

### 4.4 Import permissions

- **Individual training plans** (one athlete): only that athlete imports them.
- **Team training plans** (2+ athletes, all on one team): either team member can import them. They're owned by the team.
- **Nutrition plans:** each athlete imports their own (D7).
- **Approving a version** follows the same rule as importing it.

### 4.5 Required tests (M2, then extended per milestone)

A parameterized matrix runs every DAL read function × category × sharing on/off × relationship (self, teammate, stranger). The required assertions:
- A can't read B's private categories.
- A can read B's shared ones.
- A loses access as soon as B toggles a category off.
- The health screen is never readable by anyone but the owner.
- IDOR: A can't update or delete B's log by guessing its ID.
- A removed allowlist email is denied even with a live session.

---

## 5. JSON plan import pipeline

The file format, including every field, null rule and error/warning, is specified in **[IMPORT_FORMAT.md](IMPORT_FORMAT.md)**. This section covers how the app processes a file.

All stages are pure functions except where marked **[DB]**. Each stage appends to one report:
- Each entry is `{ level: error|warning|info, code, path, message, context: {date, meal, item, session} }`.
- `path` is the JSON path (e.g. `days[2].meals[0].items[1]`), so every message points at the exact spot in the file.

### 5.1 Stages

1. **Receive.** Paste a file or upload it. The browser reads the file as text, and both routes go to the same Server Action.
   - Limit: 1 MB of text.
   - Compute `sha256`. If it matches an earlier committed import, warn: "Identical to v3 of …".
2. **Parse.** `JSON.parse`. A syntax error is reported with line and column.
3. **Envelope.** Read `schemaVersion` and `kind`, then pick the Zod schema (`training-v1`, `nutrition-v1`).
   - Unknown version → a clear error that lists the supported versions.
   - Objects are `z.strictObject(...)`, so a typo like `distanceMeters` is an error, not silently ignored.
   - Dates use `z.iso.date()`.
4. **Structural checks** (pure):
   - `startDate ≤ endDate`, and every date is inside that range.
   - Dates are real calendar dates (`2026-02-30` is rejected).
   - Session athletes ⊆ plan athletes.
   - `joint` ⇒ at least 2 athletes.
   - `perAthlete` keys ⊆ session athletes.
   - Positions and order are taken from array order.
   - Nutrition:
     - Food keys are unique.
     - Every `foodKey` resolves.
     - One `days[]` entry per date.
     - Target min ≤ max.
     - Price units must convert to grams.
   - Sanity warnings: kcal vs. 4/4/9 Atwater more than 15% off, or macros over 100 g per 100 g.
5. **Resolve [DB]:**
   - `athleteKey` → athlete. The athlete must exist and the importer must be allowed to import for them (§4.4).
   - `stationKey` → `station.id`, within the plan's event category (from the file's `eventCategory`, else the team's race entry).
   - Station-like `category` values are checked against that category's station keys.
   - Plan target: match by `planKey` (owner + kind), else offer "new plan" or a choice in the preview.
   - Foods: new key, unchanged revision, or **changed** (new revision, with a field-by-field diff shown).
   - Prices: new, or duplicate of an existing (food, asOf, source).
6. **Domain checks [DB for rule and log lookups]:**
   - **Diet rules (nutrition, ERROR):**
     - Every item on every day is checked against the athlete's rules active on that date.
     - The error names the date, meal and item, e.g. "2026-10-15 (Thu, vegetarian day) — lunch 'Chicken curry' — item 'chicken_breast' is chicken".
     - Eggs on a vegetarian day with `eggsAllowed = null` → error "eggs pending".
     - `excludedItems` match whole words against the food name or key.
   - **Totals vs. `expectedTotals` (WARNING):** per nutrient, flagged when more than 5% off.
   - **Cost vs. `budgetInrPerDay` (WARNING):** compares the budget cost (excluding `excludeFromBudget` items), shows the ₹ gap and never rounds it down. Unpriced items make the day's cost "incomplete", not ₹0.
   - **Run spike (WARNING, training):** each planned run vs. the longest *logged* run in the previous 30 days. For future dates, earlier planned runs in the same file also count toward the baseline. With no baseline: info "can't assess".
   - **Overlap:**
     - Nutrition: another approved nutrition version covering the same athlete and date → error (one meal plan per day).
     - Training: an overlap is a warning.
7. **Preview.** Save a `plan_import` row (status `previewed` or `rejected`) and show:
   - The target ("New version 4 of 'Oct block'").
   - Date range and athletes.
   - Counts by type.
   - Food diffs.
   - A per-day totals and cost table.
   - All errors and warnings grouped by date.
   - Any error disables Confirm.
8. **Confirm.** The user picks **Import as draft** or **Import and approve**. The file's `status` only sets the default choice.
9. **Commit [DB, one transaction]:**
   - Lock the `plan_import` row (`FOR UPDATE`; already committed → return the existing version, so it's idempotent).
   - Lock the `plan` row and compute `version_number = max + 1`.
   - **Re-run stages 5–6** against current data, since rules or logs may have changed since the preview.
   - Bulk-insert the version, athletes, sessions, blocks, prescriptions or foods, revisions, prices, targets, days, meals and items.
   - If approving: archive the previously approved version in the same transaction (the partial unique index guarantees there's only one).
   - Mark the import `committed`. Either all of it lands or none of it does.

Previews older than 24 hours become `expired`. Old versions stay viewable at `/plans/[planId]/v/[n]`, along with their raw source.

### 5.2 After import

- Only **approved** versions drive Today, the calendar and meal logging. Drafts can be previewed but not logged against.
- Logs keep pointing at the session or meal they were logged against, even after a newer version is approved. History shows "logged against v2".
- If diet rules change after a plan is approved, the plan view re-runs the engine on display and shows warnings. Approved content is never mutated.

### 5.3 Diet-rule engine (`src/lib/nutrition/diet-rules.js`, pure, shared by import and logging)

- **Active rules for a date:**
  - Weekday rules where `weekdayOf(date) === weekday`. The weekday is computed from the date string through `Date.UTC`, so there's no timezone shift.
  - Date-range rules where `start ≤ date ≤ end`.
- **Allowed diet tags when any vegetarian rule is active:**
  - `veg` is allowed.
  - `egg` is allowed only if **every** active vegetarian rule has `eggs_allowed === true` (strictest wins; `null` = no).
- **Excluded items:** the union across active rules.
- **Callers:** import treats violations as errors; meal logging shows warnings and never blocks.

### 5.4 Nutrition math (`src/lib/nutrition/`)

- **Item value:** `grams / 100 × per100g`.
- **Unknown fibre:** a food with unknown fibre makes that day's fibre total "incomplete".
- **Cost per gram:** `price_inr / (per_qty × grams per unit)`.
  - Uses the most recent `food_price` with `as_of ≤ date`; if there's none, the earliest later price.
  - No price at all → the day's cost is "incomplete", never ₹0.
- **Two totals per day:**
  - **Day cost:** every priced item. It's shown as a breakdown, with excluded items marked, and it's what `expectedTotals.costInr` is compared with.
  - **Budget cost:** the day cost minus items whose chosen price has `exclude_from_budget`. Only this is compared with `budgetInrPerDay`.
  - The grocery list still lists excluded items, with quantities, and marks them as already paid.
- **Display:** cost is **rounded up** to the rupee, and the overage is `displayed budget cost − budget`, shown in ₹.

### 5.5 Station split rules (`src/lib/race/station-split.js`)

- **Switch count:** `segments − 1`. For `max_switches` stations (row: 1), exceeding it is an error.
- **Swap-zone-only stations (carry, lunge):** every switch must be marked `atSwapZone`. The UI also always shows RuleNote #6 (swap-zone positions aren't published).
- **Total:** the sum of amounts ≠ the station target → warning.
- **No minimum split:** the rulebook states no minimum work split per partner (RuleNote #7), so none is enforced.

### 5.6 Import format

The final format is **[IMPORT_FORMAT.md](IMPORT_FORMAT.md)** (approved 2026-10-13). Its two examples are test fixtures.

Changes from the brief's original example shapes:
- **`planKey`** (slug): identifies which plan a version belongs to. Without it, the preview asks.
- **`eventCategory`** (`"yoddha_s3_mumbai_2026/mens_doubles"`): context for station keys. It defaults to the team's race entry.
- **Session `lighterOption`:** the low-sleep feature needs it.
- **Session `joint`:** optional, default `false`. **`blocks`** may be left out for `rest` sessions.
- **Price `gramsPerUnit`:** required for `ml`, `l` and `piece`.
- **`perAthlete` overrides:** same shape as the exercise (`sets, reps, distanceM, durationSec, load, restSec, targetRpe, notes`). A field you give replaces the base value, and `load` is replaced as a whole.
- **Null vs. zero:** unknown values are `null` or left out, and `0` means zero.
  - `[0, 0]` target placeholders are rejected.
  - `per100g.fibreG` may be `null` (unknown).
  - Macro target ranges other than kcal are optional.
- **Exercise `category`:** `run | strength | conditioning | mobility | other`, or a station key of the plan's event category.
- **Price `source`:** now required, like food `source`, so every price is traceable.
- **JSON Schema export:** `npm run import-schema` writes JSON Schema from the Zod schemas into `docs/import-schema/` (M2). It covers structure only; the cross-field rules are checked in the import preview.

---

## 6. Time and dates

- **One module, `src/lib/dates.js`, with no library:**
  - `todayIn(tz = 'Asia/Kolkata')` via `Intl.DateTimeFormat('en-CA', { timeZone })`.
  - `addDays`, `diffDays`, `weekdayOf`, `isoWeekOf` and `rangeDates`, all string-in/string-out via `Date.UTC`.
  - It's unit-tested, including the 00:00–05:30 IST window where the UTC date differs.
- **Weeks** are ISO weeks (Mon–Sun) in IST.
- **No `new Date('YYYY-MM-DD')` outside `dates.js`.** An ESLint `no-restricted-syntax` rule enforces this.
- **Raw `pg` queries are the remaining trap.** Drizzle disables `pg`'s date parsing for its own queries, but a raw `pool.query()` would still turn a `DATE` into a local-time JS `Date`. So:
  - `db/client.js` also sets `pg.types.setTypeParser(1082, v => v)` globally.
  - The DAL never calls `pool.query` directly.

---

## 7. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest (node) | All of `src/lib` (dates, diet rules, nutrition math, load, run spike, split rules), Zod schemas against fixture files, the import report mapper |
| Integration | Vitest against Docker Postgres `yoddha_test` | DAL + authz matrix, IDOR, import commit atomicity and idempotency, DB constraints, seed idempotency |
| E2E | Playwright (M10) | Smoke: sign-in, import → preview → commit, log a set, check-in red flag, partner can't see private data |

- **Test projects:** two Vitest projects, `unit` (parallel) and `integration` (serial, migrated once in global setup, tables truncated per file).
- **Import test inputs:**
  - The two IMPORT_FORMAT.md §8 examples (fixtures).
  - The owner's **real pilot plans** in `data/plans/pilot/` (one training, two nutrition). These are never seeded. They must pass the structural schemas from M2, and import with **no errors** once the importer exists (M5 training, M6 nutrition).
- **E2E sign-in:** Google OAuth can't run in CI, so Playwright inserts a session row into the **test** DB and sets the signed cookie with the test secret. There's no auth bypass in app code.

---

## 8. Deployment

### 8.1 Recommendation: Vercel (Hobby) + Neon (Free), both in Singapore, Postgres 18

| | Choice | Why |
|---|---|---|
| App | **Vercel Hobby**, functions pinned to **`sin1` (Singapore)**, Node **24.x** | Zero-ops Next.js hosting with preview deploys. Node 24 is Vercel's default (22 is the only alternative; 20 was deprecated 2026-10-01). Fluid compute is on by default. Hobby is "non-commercial personal use only", which fits now; move to Pro if this becomes a product. |
| DB | **Neon Free**, region **`aws-ap-southeast-1` (Singapore)**, **Postgres 18** | 1 GB storage and 100 CU-hours per project per month, far more than 2 users need. It **doesn't pause the project**; it scales compute to zero after 5 min idle and wakes in "a few hundred milliseconds". PG18 is GA on Neon. |
| Local | Docker Desktop, `postgres:18` | Same major version as prod. Note for PG18 images: mount the volume at `/var/lib/postgresql`, not `…/data`. |

**Why Singapore and not Mumbai:**
- Neon has **no India region**; Singapore is the nearest.
- A page makes several sequential queries. Putting Vercel functions in the **same region as the database** makes each query a local hop, and the cross-border latency is paid once per request (browser → sin1), not once per query.
- Putting functions in `bom1` (Mumbai) next to the users and the DB in Singapore would be slower overall.

**Why not Supabase:**
- Supabase does have Mumbai (`ap-south-1`), but its free tier still **pauses projects after 7 days of low activity** and has **no backups**.
- Its main extras (auth, storage, realtime) wouldn't be used, since Better Auth handles auth.

**Why not a VPS:**
- TLS, OS patching, Postgres backups, uptime and security of health data become our job, for a 2-user app with a 39-day horizon.
- That's a good option later at product scale, not now.

### 8.2 Connections and environments

- **Runtime:** the Neon **pooled** connection string (`-pooler` host, PgBouncer in transaction mode) via a small node-postgres `Pool` (`max: 5`) registered with `attachDatabasePool`. That's Neon's Vercel Fluid compute example.
  - Neon also says to avoid stacking client pooling on its pooler, or else release connections promptly. Drizzle does release promptly: it checks a client out per query or per transaction and returns it immediately.
  - The app uses no session-level features (`SET`, `LISTEN`, advisory locks), which PgBouncer's transaction mode doesn't support.
  - If we see connection trouble, the fallback is the direct URL with the same small pool.
- **Migrations and `pg_dump`:** the **direct** connection string. Neon says pooled connections don't suit migrations or dumps.
- **Env vars:** `DATABASE_URL` (pooled, runtime) and `DATABASE_URL_DIRECT` (migrations, backups), each scoped to Production only in Vercel.
- **Preview deployments:**
  - They use a separate Neon branch `dev` (Free allows 10 branches) with its own Google OAuth redirect URI, or previews are switched off.
  - No Neon–Vercel integration is needed for v1.
- **Migrations are never run in the Vercel build.** Flow:
  1. `drizzle-kit generate` locally.
  2. Review the SQL in the PR.
  3. `npm run db:migrate:prod`. It takes a backup first, stops if the backup fails, then migrates over the direct URL.
  4. Merge to `main`, which triggers the deploy.
- Migrations are written expand-then-contract, so the running version keeps working while it's applied.

### 8.3 Backups

The procedure is in **[BACKUP.md](BACKUP.md)**. In summary:
- **Neon Free's history window is only 6 hours** (capped at 1 GB of change history). That's not a backup.
- `npm run db:backup` runs `pg_dump` from the `postgres:18` Docker image against the direct URL, so nothing needs to be installed on Windows. It writes a timestamped file to a git-ignored `backups/` folder.
  - The script is built in M2, **before** the first production deploy, so it exists before any real data does.
  - Run it weekly, before every prod migration, and around race week.
- Restores are tested monthly into the local Docker database.
- *Optional, ask first:* a scheduled GitHub Action that stores an encrypted dump. This puts health data in GitHub, so it's the owner's call.

### 8.4 Git and release flow

- **`main`** is production. Vercel deploys production from `main` only.
- **One branch per milestone** (`m1-scaffold`, `m2-backend`, …), with one commit per batch.
- **At each milestone review,** the owner approves and the branch is merged to `main`. For milestones after M2, that merge is the production release.
- **Repo:** a private GitHub repository.
- **Commits:** imperative subject lines that name the batch (e.g. "M1.3: local Postgres via Docker Compose").

### 8.5 Cost

**₹0** within the free limits:
- Neon: 100 CU-hours and 1 GB per project.
- Vercel Hobby: 4 Active-CPU-hours, 360 GB-hrs and 1M invocations per month.

Neon's paid Launch plan has no monthly minimum ($0.106/CU-hour), but it's a paid service, so it needs the owner's approval and isn't needed now. No Vercel cron jobs are needed: expired import previews are cleaned up lazily on the next import.

---

## 9. Batch plan per milestone

- **Batches:** each batch is 2–3 related hand-written files. Generated files (lockfile, migrations, CLI-generated auth schema, shadcn primitives) don't count toward that.
- **After every batch:** explain → `npm run lint` + relevant tests → manual-check list → commit.
- **End of each milestone:** stop for review.

`CLAUDE.md` was created right after M0 approval, before M1.

**M1 — Scaffold** (branch `m1-scaffold`)
1. `create-next-app@16.4.0` (JS, App Router, `src/`, Tailwind, ESLint, `@/*` alias), then trim the boilerplate. Hand-edited: `next.config.mjs`, `src/app/layout.js`, `src/app/page.js`.
2. `eslint.config.mjs` (layer import rules, no-`new Date(string)` rule), Prettier config, `package.json` scripts.
3. shadcn/ui init (JS mode, Base UI) → `components.json`, plus dark design tokens in `src/app/globals.css`.
4. `docker-compose.yml` (Postgres 18, dev + test DBs), `docker/initdb/01-create-test-db.sql`, `.env.example`.
5. `vitest.config.mjs` (unit/integration projects), `src/lib/dates.js` + tests (the first real module; it also proves the test setup works).
6. `README.md` skeleton, plus the `CLAUDE.md` commands section filled in.

**M2 — Backend foundation (+ first deploy)** (branch `m2-backend`)
1. `src/server/env.js` (Zod-validated env), `drizzle.config.js`, `src/server/db/client.js` (pool, `attachDatabasePool`, DATE type parser), `schema/_shared.js` (enums, column helpers).
2. `schema/identity.js`, `schema/race.js`.
3. `schema/plans.js`, `schema/training.js`.
4. `schema/nutrition.js`, `schema/recovery.js` → generate the first migration and review the SQL.
5. Better Auth: `server/auth/auth.js`, `app/api/auth/[...all]/route.js`, generated auth schema, allowlist hook.
6. `server/auth/viewer.js`, `proxy.js`, sign-in page.
7. `server/authz/policy.js` + unit tests.
8. Zod: `schemas/common.js`, `schemas/import/training-v1.js`, `schemas/import/nutrition-v1.js` + fixture tests. These cover the §8 examples, `excludeFromBudget`, and the `data/plans/pilot/` files, which must pass.
9. `tests/helpers/db.js`, `tests/helpers/factories.js`, `tests/integration/authz.test.js` (cross-user denial).
10. `scripts/db-backup.mjs`, `scripts/db-restore-check.mjs` + `npm run db:backup` / `db:restore-check` / `db:migrate:prod` (backup, then migrate). This comes before deploy, so backups exist from the first real row (BACKUP.md).
11. **Deploy:**
    - **Gate:** Next.js bumped to the patched 16.4.x, and `npm audit --omit=dev` (production dependencies) clean of critical/high issues.
    - Set up the Vercel project (`sin1`) and Neon (Singapore, PG18), run the prod migration, and add the Google OAuth redirect URIs.
    - Result: both athletes can sign in at one URL.

**M3 — People and daily tracking**
1. Onboarding question set v1 + answers schema + `dal/onboarding.js`.
2. Onboarding UI (stepper) + actions, health-screen banner.
3. Profile + sharing settings (DAL + page + actions).
4. Diet rules CRUD (Chinmay's rules are entered here by the user, not seeded).
5. Team + invite (DAL, invite link, accept page).
6. Daily check-in (DAL, form, red-flag stop message) + tests.
7. Benchmarks: built-in run types (`run_700m`, `run_1km`, `run_5km`) + custom types, entry form with a required effort field, list (charts come in M8).

**M4 — Race**
1. Seed data file + seed Zod schema + `scripts/seed.js` (idempotent) + test. This also seeds the station and sim benchmark types.
2. `dal/race.js` + stations list/detail pages.
3. Rule-notes page (status badges, re-verify note) + countdown component + race-entry (wave) settings.
4. Checklist (DAL, UI, per-item private toggle, "add suggested items from kit rules").

**M5 — Training**
1. `server/import/parse.js`, `envelope.js`, `report.js` + tests.
2. Training structural + resolve checks + tests.
3. Training commit (transaction, versioning, approve/archive) + integration tests.
4. Import UI: paste/upload → preview → confirm.
5. Calendar week/day views + `dal/training.js` reads.
6. Session detail page.
7. Workout logging (one-tap sets, `useOptimistic`) + actions + IDOR tests.
8. `lib/training/run-spike.js` + tests + UI flags.
9. Plan history/versions page, approve/archive actions.
10. Basic "Today" view: countdown + today's session(s) + check-in status, so the app is useful from here on (D1).

**M6 — Nutrition**
1. Nutrition structural/resolve checks (food revisions, price units) + tests.
2. `lib/nutrition/diet-rules.js` + exhaustive tests (weekday, ranges, eggs pending, exclusions, IST edges).
3. `lib/nutrition/totals.js`, `cost.js` + tests (5% flag, round-up, unpriced = incomplete).
4. Nutrition commit + preview UI (reuses the M5 import UI).
5. Plan day view + totals vs. targets.
6. Meal logging: ate-as-planned, edit grams, unplanned food, rule warnings.
7. Grocery list for a date range + cost.

**M7 — Dashboard:** (1) nutrition card + cost vs. budget, (2) diet-rule badge + quick-log links, (3) empty states + low-sleep → lighter-option prompt.

**M8 — Analytics:** (1) `lib/analytics/*` (weekly load, run km, longest run, sleep avg, adherence) + tests, (2) Recharts dark-theme wrappers, (3) analytics page + benchmark trend charts.

**M9 — Team:** (1) shared calendar of joint sessions, (2) side-by-side benchmarks (sharing-aware), (3) station split planner + `lib/race/station-split.js` + tests, (4) team/individual checklist view.

**M10 — Hardening** (the app has been live since M2):
1. Playwright config + smoke tests.
2. Error boundaries, action error shapes, security headers.
3. Docs: setup, env, migrations, testing, deploying, adding the partner, backups.
4. *Optional:* per-user JSON export of one's own data.

**If time slips (owner's priority, D1):**
- **Always keep:** logging (workouts, check-ins, benchmarks, meals), plan views and race pages.
- **Simplify or drop first:** analytics charts (M8) and advanced partner views (M9: side-by-side benchmarks, the station split validator).
- **Then:** the grocery list, and onboarding sections beyond profile, health, diet and partner.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Timeline:** 39 days to race, 10 milestones with review stops | The app is useful only for the last weeks, or not at all before taper | D1: deploy at M2, thin Today after M5, cut list in §9. Review turnaround is the main lever. |
| Date-only values shifting through UTC (e.g. a check-in at 01:00 IST landing on the previous day) | Wrong-day logs, wrong diet rules | String-mode `date` columns; the single `dates.js`; lint rule; tests for the 00:00–05:30 IST window |
| Authorization mistakes (partner sees private meals/weight/health) | Privacy breach between the two users | DAL-only DB access (lint-enforced), SQL scoping, DTO masking, matrix + IDOR tests, no client-supplied owner IDs |
| Food values changing under existing plans | Silent history rewrite | Immutable `food_revision` (D5) |
| Free-text `excludedItems` (onion, garlic) can't see inside composite dishes ("pav bhaji") | False negatives on import | Whole-word match on food name/key; the preview says matching is by item name only. Plans should list ingredients as items (the brief already requires oil, ghee etc. as items). |
| Missing prices treated as ₹0 | Budget looks better than reality | Unpriced = "incomplete" with a count; never 0 |
| Rule changes by organisers (the rulebook allows any change) | Stale race info | `verified_at`, status badges, the re-verify note; seed is an idempotent upsert, so updates are one data-file edit |
| Neon free compute scales to zero | First request after idle ~0.5–1 s slower | Acceptable for 2 users; noted |
| Vercel Hobby is for non-commercial use | Fine now; not for the future product | Move to Pro when it becomes a product |
| Better Auth CLI importing a config that imports `server-only` | CLI crash | Keep `auth.js` free of `server-only`; guard at the DAL/viewer layer instead |
| E2E with Google OAuth | Can't automate the real login | Test-DB session injection (§7) |
| Health data on US-company infrastructure; India DPDP Act | Fine for two consenting friends; a compliance item for the future product | Noted; revisit before public signup |
| Library churn: Drizzle 1.0 is in RC and its docs already describe v1; Next 17 is coming | API drift mid-project; docs showing APIs we don't have | Exact versions pinned; core query builder only; docs re-checked before each milestone, per the brief |
| Next.js security patch announced for 2026-10-14 (not yet published when M1 started) | Deploying a vulnerable version | M1 scaffolds on 16.4.0 locally; bumping to the patched release is a hard gate before the M2 deploy; `npm audit` at each milestone |
| Neon Free holds the only copy of the logs | Data loss | BACKUP.md procedure; backup script built before the first deploy; monthly restore test |
| `npm audit`: 5 high findings, all one dev-only chain (`eslint-config-next` → `fast-glob` → `micromatch` → `braces` ≤ 3.0.3, a ReDoS-style DoS on crafted glob patterns). No fixed `braces` release exists (2026-10-13). | Lint tooling only; nothing ships to production, and we control every glob pattern | Accepted. Production dependencies audit clean. Re-check at each milestone and take the fix when `eslint-config-next` updates. |
| `npm audit --omit=dev`: 4 moderate findings (2026-10-13). `better-auth` depends on `drizzle-kit`, whose bundled `@esbuild-kit` loader pins `esbuild` 0.18 (GHSA-67mh-4wv8-2f99: esbuild's *dev server* answers cross-origin requests). | None in practice: nothing runs esbuild's serve mode | Accepted (below the critical/high deploy gate). Re-check when `drizzle-kit` or `better-auth` update. |
| Better Auth's advisory history | Auth bypass | ≥ 1.7.7, zero plugins, advisories checked per milestone |
| `cacheComponents` + `'use cache'` on per-user data | One athlete served the other's cached data | `'use cache'` only for race reference data; CLAUDE.md rule; authz tests render as both users |

---

## 11. Resolved questions (owner, 2026-10-13)

1. **Timeline:** deploy at the end of M2; basic "today" view after M5; cut order as in §9.
2. **Imports:** each athlete imports their own nutrition plan; either team member can import a team training plan.
3. **Run-spike definition.** This follows Frandsen et al., *BJSM* 2025;59(17), "How much running is too much?". The study compares a single session's distance with the longest single run in the previous 30 days; injury hazard was 1.64× for a 10–30% spike.
   - Session run distance = the sum of `run`-category distances in that session.
   - The baseline is logged runs only. Planned runs count as a projected baseline in the import preview.
4. **Benchmarks:**
   - Built-in types: one per station at race spec, 700 m run, 1 km run, 5 km run, half-race sim and full race sim, plus custom types.
   - Every benchmark has an effort value.
5. **shadcn/ui:** approved, in JavaScript mode.
6. **Individual checklist items:** visible to the partner by default, with a per-item private toggle.
7. **Git:** `main`, a private GitHub repo, one branch per milestone, merged at each review. Vercel deploys from `main`.
8. **Region:** Singapore for both Vercel functions and Neon.
