# Yoddha Prep — Project Brief for Claude Code

Save this file as `docs/PROJECT_BRIEF.md` in the project repo. It is the source of truth for what to build and how to work.

**Status (2026-10-13):** M0 is approved. This brief has been updated to match the decisions. The companion documents are authoritative on detail:
- [ARCHITECTURE.md](ARCHITECTURE.md): stack, full schema, authorization, batch plan.
- [IMPORT_FORMAT.md](IMPORT_FORMAT.md): the plan JSON format.
- [BACKUP.md](BACKUP.md): backups and restores.

---

## 0. How to work (standing rules)

- **Role:** senior full-stack developer and UI/UX designer.
- **M0 is done:** the architecture was approved on 2026-10-13 (`docs/ARCHITECTURE.md`). Build one milestone at a time from M1.
- **Git:** one branch per milestone (`m1-scaffold`, `m2-backend`, …), merged to `main` at each milestone review. Vercel deploys production from `main`.
- **Small batches:** after approval, build in batches of 2–3 related files. After every batch:
  1. Explain what was built and why.
  2. Run lint and the relevant tests, and report the results.
  3. List anything the owner should check manually.
  4. Commit with a clear message.
- **Stop for review** at the end of each milestone before starting the next.
- **Language:** JavaScript, not TypeScript. JSDoc types are fine.
- **Check current docs:** verify versions and APIs (Next.js, auth library, ORM, charting) in official docs before using them. Don't rely on memory for library APIs.
- **No fake data:**
  - Never present hardcoded or demo data as working backend functionality. Use honest empty states instead.
  - The only seed data allowed is the verified race reference data in §4 and the owner-approved built-in benchmark type definitions (§8).
  - Training plans, meal plans, nutrient values, prices and benchmarks enter the app only through the import format in §7, or through user entry.
- **Never invent food composition values.** Every food record carries a `source` and an `isEstimate` flag.
- **Ask first** before adding a paid service, a major dependency, or anything that changes the data model after it's approved.
- **Secrets:** never commit them. Keep `.env.example` up to date.
- **After M0 is approved,** create a short `CLAUDE.md` (under about 60 lines) with these standing rules, the build, test and lint commands, and a pointer to this file.

---

## 1. Product context

- **Users now:** two athletes, Chinmay (owner) and Aryan, racing **Yoddha Race, Men's Doubles, Mumbai regional, 21–22 Nov 2026**. Their wave day is assigned 10–14 days before the race.
- **Purpose:** a shared, deployed web app where each athlete signs in to their own dashboard (training, meals, nutrition progress, recovery, benchmarks), plus a shared team view.
- **Plans come from outside the app.** Training and nutrition plans are written and validated elsewhere and **imported as JSON** (§7). In v1 the app stores, displays, validates, logs and analyses plans. **It does not generate plans.**
- **Future direction (design for it, don't build it yet):** a multi-user product where onboarding answers produce a plan and diet for a given goal or event. That means:
  - Events and goals are data, not hardcoded Yoddha logic.
  - Onboarding answers are stored as structured, versioned data.
  - Plan content is kept separate from logs.

---

## 2. Stack (decided in M0)

Versions, reasons and the alternatives considered are in ARCHITECTURE.md §1.

- **App:** Next.js 16.4 (App Router), React 19, JavaScript. Server components for reads, server actions for writes. Pin the patched 16.4.x security release before the first deploy.
- **Database:** PostgreSQL 18.
  - Local: Docker.
  - Hosted: **Neon** (Free plan, Singapore region).
- **ORM:** **Drizzle 0.45** (stable), core query builder only. It was chosen over Prisma for date-only string columns, plus CHECK constraints and partial indexes in a JavaScript schema.
- **Auth:** **Better Auth ≥ 1.7.7** with Google sign-in only. Sign-in is restricted to an allowlist (`ALLOWED_EMAILS` env var) until public signup exists.
- **Validation:** Zod 4 on every server-side input, including JSON imports.
- **UI:** Tailwind CSS 4 + shadcn/ui (JavaScript mode). Recharts 3 for charts.
- **Tests:** Vitest for unit and integration tests, against a test database. Playwright smoke tests for critical flows in M10.
- **Deploy:** **Vercel Hobby (functions in Singapore, `sin1`) + Neon Free (Singapore)**, so both athletes reach one URL.
  - The first production deploy is at the end of M2.
  - Backups: `docs/BACKUP.md`.
- **Time and dates:**
  - App timezone is **Asia/Kolkata**.
  - Plan and log days are **date-only values (YYYY-MM-DD)** and must never shift through UTC conversion.
  - Timestamps are stored in UTC.

---

## 3. Users, teams, privacy, authorization

- **Profiles:** one `AthleteProfile` per authenticated user, with a unique `athleteKey` slug (e.g. `chinmay`, `aryan`) used by imports.
- **Teams:** a `Team` (doubles pair) links two users. A `RaceEntry` links the team to an event category and holds the wave date and time, reporting time and bib.
- **Sharing with partner, per category:**
  - Shared by default: training plan and logs, benchmarks.
  - Private by default: meal logs (together with nutrition plans, targets and diet rules), body weight, daily check-ins.
  - The user can toggle each category in settings.
  - Health-screen answers (and all onboarding answers) always stay private.
  - Team-owned content (team training plans, joint sessions, team checklist, station splits) is always visible to both team members.
  - Individual checklist items are visible to the partner by default, with a per-item "private" toggle.
- **Authorization is server-side only.**
  - Every read and write is scoped to the session user, or to team-shared categories.
  - Never trust a user ID sent from the client.
  - Tests must prove that user A cannot read user B's private data.

---

## 4. Race reference data — verified 12 Oct 2026 (seed this)

**Sources:**
- https://theyoddharace.com/race-format
- https://theyoddharace.com/rule-book-english
- https://theyoddharace.com/

Store `verifiedAt` and the source URLs. Show a "re-verify in race week" note, because the rulebook says management can change any zone.

**Event and category**
- **Event:** The Yoddha Race, Mumbai regional, 21–22 Nov 2026. Reporting time is sent 10–14 days before; waves are allotted, not chosen.
- **Category:** Men's Doubles (2 men, one team). Loads are identical to Male Open.
- **Format:** 7 × (700 m run → workout zone), in fixed order. Total running is 4.9 km.
- **Finisher medal:** awarded only for finishing under 90 minutes.
- **Season 3:** no regional cash prizes. Finale qualification comes from a season-long leaderboard; the top 25 doubles teams race the finale.

**Stations (Men's Doubles)**

| # | key | Zone | Spec | Doubles switching | Key faults and penalties |
|---|---|---|---|---|---|
| 1 | row | Rowing | 1,000 m at "Resistance 7" | One athlete at a time; **max 1 switch**; partner stays in waiting area | Leaving the machine early or short distance = DNF; wrong resistance = penalty or restart; improper switch +5 min; handle not returned +5 min |
| 2 | sled_push | Sled push | 150 kg, 50 m total with turns | Multiple switches; partner in same lane, behind | Turning before the sled fully crosses the line +5 min each; must face direction of travel (else +5 min); short distance = DNF |
| 3 | sled_pull | Sled pull | 100 kg, 50 m total, rope | Multiple switches; partner in designated area | Pulling outside athlete box = judge's penalty; early turn +5 min; rope into another lane +5 min; must remain standing |
| 4 | kb_carry | Kettlebell carry | 2 × 24 kg, 200 m | One athlete carries both bells; **switch only at swap zone**; partner behind in same lane | Carrying one bell at a time +5 min; wrong weight = DNF; advancing bells while resting +5 min; improper switch +5 min or DQ |
| 5 | box_jump | Box jumps | 30 reps, 60 cm | Multiple switches; reps from designated side; partner behind | No-rep for: no full hip and knee extension, staggered take-off, single-foot landing, using hands. Stepping down is allowed |
| 6 | lunge | Lunge walk | 100 m, 20 kg sandbag across both shoulders | **Switch only at swap zone**; changing sandbag outside swap zone = DQ | Knee not touching +5 min; same lead leg twice in a row +5 min; bag not across both shoulders +5 min; switching before swap zone +5 min (conflicts with DQ rule, see below) |
| 7 | wall_ball | Wall balls | 75 reps, 6 kg ball, 9 ft target | Multiple switches; partner behind | No-rep for: target missed, hip not below knee. Full extension required before the next rep |

**General rules**
- Wrong lap count: +5 min per error.
- Missing a run or a zone: DQ.
- Zones out of order: first time +5 min, second time DQ. You cannot go back once you enter the last zone.
- Littering or spitting: +2 min per incident.
- Kettlebells and sandbags must be left at the designated area.
- Wait for the judge's confirmation before leaving a zone.
- The medical team can remove an athlete, which counts as DNF.

**Kit**
- Fully enclosed athletic shoes are mandatory. Minimalist and toe shoes are banned: you can't start in them, and wearing them during the race is a DQ.
- Allowed: knee sleeves, gloves, weightlifting belt, wristbands, hydration packs (but see contradictions below).
- Banned: lifting straps, wrist straps, "gym belts", headphones, phones.

**Hydration**
- Drink only at course hydration stations.
- No personal bottles anywhere on the course.
- Gels may be carried.

**Unresolved items** — seed as `RuleNote` with status `unconfirmed` or `contradictory`:
1. The rulebook does not say whether both partners must run every 700 m together. Assume yes, since that is the HYROX convention, until the organisers confirm.
2. "Resistance 7" on the rower isn't defined. Assume Concept2 damper 7.
3. Hydration packs are listed as allowed, but the hydration section bans bottles in hydration packs.
4. "Weightlifting belt" is allowed, but "gym belts" are prohibited.
5. An illegal lunge switch is listed as both +5 min and DQ.
6. Swap-zone positions and sled lane lengths are not published.
7. No minimum work split per partner is stated.

**Model all of this as data:**
- `Event`
- `EventCategory`, with run segment distance and count, team size, and medal cut-off
- `Station`, with order, key, name, metric (distance or reps), target, load, equipment spec, movement standards, doubles rules, and faults with penalties
- `RuleNote`
- `RaceEntry`: a team's (or athlete's) entry in an event category, with wave date/time, reporting time and bib. The countdown uses the wave date once it's assigned, and otherwise the event start date.

A future event (HYROX, a 10K, and so on) should be new rows, not new code.

---

## 5. Dietary rules (entered through onboarding or settings; the model must support them)

**Known rules for Chinmay:**
- Vegetarian every Monday and Thursday.
- Vegetarian 2026-10-11 to 2026-10-20 inclusive (festival).
- Eggs on vegetarian days: **PENDING**. Treat pending as "not allowed".

**Aryan:** rules unknown. Set none until he enters them.

**Rule model:**
- `kind`: `weekday` or `date_range`
- `weekday` (0–6, where 0 = Sunday … 6 = Saturday, so Monday = 1 and Thursday = 4), or `startDate` and `endDate` (inclusive)
- `restriction`: `vegetarian`
- `eggsAllowed`: `true`, `false`, or `null` (pending)
- `excludedItems`: free text list, e.g. onion, garlic
- `note`

**Food diet tags:** `veg` (includes dairy), `egg`, `chicken`, `fish`, `other_meat`.

**Enforcement:**
- **On plan import:** reject any meal-plan day containing an item that violates that athlete's rules for that date, with a clear error naming the date, meal and item.
- **On meal logging:** show a warning but do not block. The log records what was actually eaten.
- **Excluded items** are matched as whole words against food names and keys. Plans should list ingredients as separate items so the check can see them (IMPORT_FORMAT.md §5).

---

## 6. Data model (approved in M0)

The full schema, with fields, types, relations, indexes and constraints, is in **ARCHITECTURE.md §2**. Changes need the owner's approval. Entity summary:

**Identity and goals**
- **User**, plus the Better Auth tables (session, account, verification).
- **AthleteProfile:** userId, athleteKey (unique, never changes), displayName, dateOfBirth, sex, heightCm, trainingExperience, availability (days, start time, max minutes), timezone (default Asia/Kolkata).
- **OnboardingResponse:** athlete, questionSetVersion, section, answers (JSON), healthFlag, completedAt. Health-screen answers live here and are always private.
- **Team**, **TeamMember** (role), **TeamInvite**, **SharingSetting** (athlete, category, visibleToTeam).
- **Goal:** athlete or team, eventCategoryId, goalType (`finish`, `medal`, `podium`, `time_target`), target time min/max (seconds), notes. `medal` uses the cut-off stored on EventCategory.

**Race reference**
- **Event**, **EventCategory**, **Station**, **RuleNote**, **RaceEntry** (see §4).

**Plans and training**
- **Plan:** kind (`training` or `nutrition`), planKey, title, owner (team or athlete), eventCategoryId.
- **PlanImport:** every uploaded file, with its raw JSON, checksum, status and validation report.
- **PlanVersion:** versionNumber, status (`draft`, `approved`, `archived`), versionNote, startDate, endDate, assumptions[], budgetInrPerDay, import (raw source), importedAt, approvedAt. Old versions are kept for history; a plan has at most one approved version.
- **PlanVersionAthlete:** which athletes a version covers.
- **TrainingSession:** planVersionId, date, position, title, type, objective, estimatedMinutes, joint, warmup[], cooldown[], recovery, stopCriteria[], lighterOption.
- **SessionAthlete:** links each session to its athletes.
- **SessionBlock:** position, name.
- **ExercisePrescription:** position, name, category, station, sets, reps, distanceM, durationSec, loadKg, loadGuidance, restSec, targetRpe (string range), notes, perAthlete (JSON overrides).
- **WorkoutLog:** athleteId, date, sessionId (nullable), status (`completed`, `partial`, `skipped`), actualMinutes, sessionRpe (1–10), notes.
- **SetLog:** workoutLogId, prescriptionId (nullable), exercise position and name, category, setNumber, reps, loadKg, distanceM, durationSec, rpe.
- **BenchmarkType:** built-in (see §8) or custom per athlete.
- **Benchmark:** athleteId, type, value, unit, effort (`easy`, `moderate`, `max`, `unknown`; always recorded), conditions, date, notes.

**Nutrition**
- **DietRule:** see §5.
- **NutritionTarget:** athleteId, effectiveFrom, kcal min/max (required), protein, carbs, fat and fibre min/max (optional), fluidNote, rationale, planVersionId.
- **Food:** the stable key.
- **FoodRevision:** immutable composition: name, dietTag, per-100 g values (kcal, protein, carbs, fat, fibre; fibre may be unknown), householdMeasures[], source, isEstimate.
  - Importing changed values creates a new revision.
  - Plans and logs keep the revision they used.
- **FoodPrice:** food, priceInr, perQty, unit (`g`, `kg`, `ml`, `l`, `piece`), gramsPerUnit (for ml, l and piece), asOf, source, isEstimate.
- **MealPlanDay:** planVersionId, athleteId, date, expectedTotals.
- **PlannedMeal:** position, type, time, name, prep, substitutions[].
- **PlannedMealItem:** food revision, grams, household measure.
- **MealLog:** athleteId, date, mealType, plannedMealId (nullable).
- **MealLogItem:** food revision, grams.

**Recovery and team**
- **DailyCheckin** (one per athlete per date): sleepHours, bedTime, wakeTime, sleepQuality (1–5), soreness (1–10) and areas, energy (1–5), fluidL, bodyWeightKg, restingHr, redFlags[], notes.
- **ChecklistItem:** team or athlete, title, category (`kit`, `admin`, `race_week`, `race_day`), dueDate, done, isPrivate (individual items only).
- **StationSplit:** race entry, station, segments (who does how much, and where the switches are), plan text, notes. Must respect station rules, e.g. row max 1 switch, carry and lunge swaps only at swap zones.

**Computed, not stored:** daily nutrition totals, daily cost, weekly training load, run-distance spike flags.

---

## 7. Plan import (JSON, schemaVersion 1)

**The exact format is [IMPORT_FORMAT.md](IMPORT_FORMAT.md)** (approved 2026-10-13). It covers every field with its type, required/optional status, enums and null rules, plus minimal valid examples. Plans generated outside the app must follow it.

**Import flow:**
1. User uploads or pastes JSON.
2. Zod validation (unknown keys are rejected).
3. Reference and rule checks: athletes, stations and foods, plus diet rules for nutrition plans.
4. Preview showing what will be created, warnings and errors. The upload is kept as an import record.
5. User confirms: import as a draft, or import and approve.
6. App creates a new `PlanVersion` in one transaction.

- Previous versions stay viewable. Athletes are referenced by `athleteKey`. Foods are referenced by `key` within the file.
- **Who may import:** each athlete imports their own nutrition plan; either team member can import a team training plan.
- **Unknown values are `null` (or left out), never `0`.**
- **Cooking oil, ghee, milk, sugar and snacks are food items with grams,** so they count toward macros and cost.
- **Totals:** the app computes totals from food values × grams. It compares them with `expectedTotals` and flags any nutrient that differs by more than 5%.
- **Cost:** the app computes cost from `FoodPrice` and shows it against `budgetInrPerDay`.
  - **Never round down, hide or soften an overage.** Show the gap in rupees.
  - Costs are rounded up.
  - A day with unpriced items shows its cost as "incomplete", never ₹0.
  - A price marked `excludeFromBudget` (e.g. protein powder already paid for) still shows in the day's cost breakdown but isn't counted against the budget.
- **Real pilot plans** live in `data/plans/pilot/`. They're never seeded; they're used as real-world test inputs for the importer.

---

## 8. Features and screens (v1)

1. **Sign-in and onboarding.** Structured, versioned questions:
   - Profile, goal and event.
   - Health screen: injuries, conditions, medications, exercise symptoms. Any "yes" shows a banner recommending medical clearance.
   - Sleep pattern and training availability.
   - Diet pattern and rules (§5), eggs on vegetarian days, allergies and intolerances, dislikes, openness to supplements.
   - Cooking setup and daily budget.
   - Partner invite (link to team).
2. **Dashboard (today)**, mobile-first:
   - Race countdown.
   - Today's session(s), with the partner's session shown when joint.
   - Today's diet-rule badge (e.g. "Vegetarian day").
   - Meals, and macros vs targets.
   - Today's cost vs budget.
   - Check-in status, and quick links to log.
3. **Training:**
   - Calendar in week and day views.
   - Session detail: warm-up, blocks, rest, RPE, load guidance, per-athlete modifications, stop criteria.
   - Workout logging per set or segment (reps, load, distance, time, RPE), session RPE, and status.
   - **Run-spike check:** warn when a planned or logged run is more than 10% longer than the athlete's longest run in the previous 30 days (Frandsen et al., BJSM 2025). A session's run distance is the sum of its run distances.
4. **Nutrition:**
   - Plan day view.
   - One-tap "ate as planned", with editable grams, plus adding unplanned foods.
   - Daily totals vs targets.
   - Diet-rule warnings.
   - Grocery list for any date range, aggregated from the plan with quantities and estimated cost.
5. **Recovery:**
   - Daily check-in.
   - **Red-flag checkboxes:** chest pain, fainting or near-fainting, dizziness, palpitations, unusual breathlessness, sharp or worsening pain. Any one ticked shows a clear "stop training today and seek medical advice" message. No diagnosis.
   - **Low sleep:** if sleep is under 6 hours, point to the session's lighter option (`lighterOption` in the plan) when one exists.
6. **Benchmarks:**
   - Record with effort level (always) and conditions, and show a history chart per benchmark type.
   - Built-in types: one per station at race spec, 700 m run, 1 km run, 5 km run, half-race sim and full race sim.
   - Athletes can also add custom types.
7. **Analytics:**
   - Weekly training load (session RPE × minutes).
   - Weekly running km and longest run.
   - 7-day sleep average.
   - Macro adherence and budget adherence.
   - Benchmark trends.
8. **Team:**
   - Shared calendar of joint sessions.
   - Side-by-side benchmarks.
   - Station split plan (rule-aware).
   - Shared and individual race checklist. Individual items are visible to the partner unless marked private.
9. **Race:**
   - Station reference pages with standards and faults.
   - Rule notes showing their verified, unconfirmed or contradictory status.
   - Race-day checklist and countdown (to the wave date once it's assigned).
10. **History:** plan versions with change notes. Logs are editable, with `updatedAt` recorded.

---

## 9. UI direction

- Premium dark interface, mobile-first: they'll log at the gym on their phones.
- Large tap targets, clear type hierarchy, tabular numbers for stats.
- Restrained accent colour, charts legible in dark mode.
- Fast entry: logging a set or a planned meal should take one or two taps.
- Empty states say what to do next (e.g. "No plan imported yet — import a plan JSON"). Never show placeholder numbers.

---

## 10. Milestones (stop for review at the end of each)

The batch-level plan is in ARCHITECTURE.md §9.

- **M0 — Architecture proposal, no code.** **Done: approved 2026-10-13** (`docs/ARCHITECTURE.md`, `docs/IMPORT_FORMAT.md`, `docs/BACKUP.md`). `CLAUDE.md` was created right after approval.
- **M1 — Scaffold.** Project setup, lint and format, shadcn/ui (JavaScript mode), Vitest, local Postgres (Docker), `.env.example`, README skeleton.
- **M2 — Backend foundation + first deploy.**
  - Schema and migrations.
  - Auth with allowlist, and authorization helpers.
  - Zod schemas.
  - Tests for persistence, validation and cross-user access denial.
  - Backup script (`docs/BACKUP.md`).
  - **First production deploy** (Vercel + Neon), after bumping Next.js to the patched release.
- **M3 — People and daily tracking.** Onboarding, profiles, team and invite, sharing settings, daily check-in with red flags, benchmarks.
- **M4 — Race.** Race reference seed (§4) with station and sim benchmark types, race pages, countdown, checklist.
- **M5 — Training.** Training plan import, calendar, session view, workout logging, run-spike check, and a **basic Today view** (countdown, today's sessions, check-in status).
- **M6 — Nutrition.**
  - Foods, prices and nutrition plan import.
  - Diet-rule engine.
  - Meal logging and daily totals.
  - Budget and grocery list.
- **M7 — Dashboard** (full version).
- **M8 — Analytics and charts.**
- **M9 — Partner and team views.**
- **M10 — Hardening** (the app has been live since M2).
  - Playwright smoke tests for critical flows.
  - Error handling and production checks.
  - Docs: setup, env vars, database init and migrations, testing, deploying, adding the partner's account, backups.

**If time slips:**
- **Always keep:** logging (workouts, check-ins, benchmarks, meals), plan views and race pages.
- **Simplify or drop first:** analytics charts (M8) and advanced partner views (M9).

---

## 11. Out of scope for v1 (keep the door open)

- Automatic plan or diet generation, and any AI calls.
- Public signup, payments, admin roles beyond owner and partner.
- Wearable or Strava integrations.
- Nutrient-target calculator.
