# Yoddha Prep — Plan Import Format, `schemaVersion: 1`

**Status:** final for schemaVersion 1, approved 2026-10-13. Amended the same day to add the optional Price field `excludeFromBudget` (§4.3), which is backward-compatible.

**For:** anyone, or any tool, that writes training or nutrition plans outside the app and imports them as JSON.

**How the app uses this spec:**
- The app's validator implements exactly this document. If the app and this document disagree, the app has a bug.
- The two examples in §8 are test fixtures, so they must always import cleanly.

---

## 1. Basics

**File**
- One JSON object per file, UTF-8, at most 1 MB.
- One plan per file: either `"kind": "training"` or `"kind": "nutrition"`.

**Keys**
- **Unknown keys are errors everywhere**, so a typo like `distanceMeters` is caught rather than silently ignored.
- Key names are camelCase and case-sensitive.

**Required vs optional**
- **Required** means the key must be present and its value must not be `null`.
- **Optional** means the key may be left out or set to `null`. Both mean "not specified / unknown".
  - **Never use `0`, `""` or a placeholder to mean unknown.** `0` means zero.
  - Where zero makes no sense, the field must be `> 0`.

**Text**
- Text is trimmed.
- Optional text that is empty or only spaces is treated as `null`.
- Required text must contain at least one non-space character.

**Lists**
- An optional list may be left out, set to `null`, or set to `[]`. All three mean "none".

**Numbers**
- Numbers are JSON numbers, never strings.
- `integer` means no fractional part.

### Value types

| Type | Format |
|---|---|
| `date` | `"YYYY-MM-DD"`. Must be a real calendar date (`2026-02-30` is rejected). It's a local date in India (Asia/Kolkata), with no time and no timezone. |
| `time` | `"HH:MM"`, 24-hour, `00:00`–`23:59`, India local time. |
| `slug` | A lowercase letter, then lowercase letters, digits or `_`. Total length 2–63. Regex `^[a-z][a-z0-9_]{1,62}$`. |
| `athleteKey` | A slug of length 2–31 (`^[a-z][a-z0-9_]{1,30}$`). It identifies an athlete profile in the app, e.g. `"chinmay"`, `"aryan"`. It's chosen during onboarding and never changes. |
| `rpe` | `"N"` or `"N-M"`, where N and M are integers 1–10 and N ≤ M. Examples: `"7"`, `"3-4"`. |
| `range` | `[min, max]`: two numbers with `0 ≤ min ≤ max` and `max > 0`. |
| short text | At most 120 characters. |
| long text | At most 2,000 characters. |
| list of text | Each item at most 500 characters, at most 50 items. |

---

## 2. Top-level fields (both kinds)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `schemaVersion` | integer | required | Must be `1`. |
| `kind` | `"training"` \| `"nutrition"` | required | |
| `title` | short text | required | Shown as the plan name. |
| `planKey` | slug | optional | Identifies the plan across versions. A file with the same `planKey`, `kind` and owner as an existing plan becomes that plan's next version. If it's left out, the import preview asks whether to add the file to an existing plan or create a new one. |
| `versionNote` | long text | optional | What changed in this version. |
| `status` | `"draft"` \| `"approved"` | optional | Default `"draft"`. This only pre-selects the choice on the confirm screen; the person importing decides. `"archived"` is not allowed in a file. |
| `startDate` | date | required | |
| `endDate` | date | required | Must be ≥ `startDate`. The plan can span at most 366 days. |
| `assumptions` | list of text | optional | Shown with the plan, e.g. "Aryan's benchmarks unknown". |

**Who owns the plan, and who may import it**

| Kind | Athletes in the file | Owner | Who may import |
|---|---|---|---|
| Training | Exactly 1 athlete | That athlete (individual plan) | Only that athlete |
| Training | 2 or more athletes, all on the same team | The team (team plan) | Either team member |
| Nutrition | `athlete` | That athlete | Only that athlete |

---

## 3. Training plan (`"kind": "training"`)

Additional top-level fields:

| Field | Type | Req. | Rules |
|---|---|---|---|
| `athletes` | list of athleteKey | required | At least 1, no duplicates. All must exist in the app; see the ownership table in §2. |
| `eventCategory` | `"<eventKey>/<categoryKey>"` | optional | The race these sessions prepare for. It's used to resolve station keys. If it's left out, the app uses the team's (or athlete's) race entry, provided there is exactly one. If the file mentions a station and no category can be found, that's an error. |
| `sessions` | list of Session | required | At least 1, at most 500. |

**Keys seeded in the app:**
- Event and category: `"yoddha_s3_mumbai_2026/mens_doubles"`.
- Station keys for that category: `row`, `sled_push`, `sled_pull`, `kb_carry`, `box_jump`, `lunge`, `wall_ball`.

### 3.1 Session

| Field | Type | Req. | Rules |
|---|---|---|---|
| `date` | date | required | Between `startDate` and `endDate`. Several sessions can share a date; their order in the file is their order on that day. |
| `athletes` | list of athleteKey | required | At least 1, no duplicates. Each must be listed in the plan's `athletes`. |
| `joint` | boolean | optional | Default `false`. `true` means the athletes do the session together, and needs at least 2 athletes. |
| `type` | `run` \| `strength` \| `station` \| `combo` \| `mobility` \| `rest` \| `test` | required | |
| `title` | short text | required | |
| `objective` | long text | optional | |
| `estimatedMinutes` | integer 1–600 | optional | |
| `warmup` | list of text | optional | |
| `blocks` | list of Block | required, except when `type` is `"rest"` | At least 1 block. A `"rest"` session may leave it out. |
| `cooldown` | list of text | optional | |
| `recovery` | long text | optional | |
| `stopCriteria` | list of text | optional | When to stop the session (pain, dizziness, …). |
| `lighterOption` | long text | optional | What to do instead if the athlete slept under 6 h or is under-recovered. After a low-sleep check-in, the app points the athlete to this. |

### 3.2 Block

| Field | Type | Req. | Rules |
|---|---|---|---|
| `name` | short text | required | e.g. "Main", "Finisher". |
| `exercises` | list of Exercise | required | At least 1. Order in the file = order in the session. |

### 3.3 Exercise

| Field | Type | Req. | Rules |
|---|---|---|---|
| `name` | short text | required | |
| `category` | string | required | One of `run`, `strength`, `conditioning`, `mobility`, `other`, **or** a station key of the plan's event category (e.g. `"sled_push"`). |
| `stationKey` | string | optional | Only for station exercises, and it must equal `category`. It can be left out because the app infers it from `category`. |
| `sets` | integer 1–100 | optional | |
| `reps` | integer 1–1000 | optional | Per set. |
| `distanceM` | number > 0, ≤ 50,000 | optional | Metres **per set**. |
| `durationSec` | integer 1–36,000 | optional | Seconds per set. |
| `load` | Load | optional | |
| `restSec` | integer 0–3,600 | optional | Rest between sets. `0` means no rest. |
| `targetRpe` | rpe | optional | |
| `notes` | long text | optional | |
| `perAthlete` | object | optional | Keys are athleteKeys from this session's `athletes`, and values are Overrides. Use it when one athlete does something different. |

**Load** — at least one of `kg` and `guidance` must be given; otherwise leave `load` out.

| Field | Type | Req. | Rules |
|---|---|---|---|
| `kg` | number > 0, ≤ 500 | optional | |
| `guidance` | short text | optional | e.g. "RPE 7 load", "same as race". |

**Override** — any of `sets`, `reps`, `distanceM`, `durationSec`, `load`, `restSec`, `targetRpe`, `notes`. They follow the same rules as on the exercise, and all are optional.
- A field you give replaces the exercise's value for that athlete. `load` is replaced as a whole, not merged.
- A field you leave out (or set to `null`) keeps the exercise's value.
- At least one field is required.

**Run distance** (used by the run-spike check):
- For each exercise with `"category": "run"`, the distance is `(sets or 1) × distanceM`, using that athlete's overrides.
- A session's run distance is the sum over its run exercises.
- Give runs a `distanceM`. A run with only `durationSec` has no distance; it isn't counted, and the preview warns about it.

---

## 4. Nutrition plan (`"kind": "nutrition"`)

Additional top-level fields:

| Field | Type | Req. | Rules |
|---|---|---|---|
| `athlete` | athleteKey | required | Must be the person importing. |
| `budgetInrPerDay` | number > 0 | optional | Each day's cost is compared with this budget. An overage is shown in ₹ and never rounded down. |
| `targets` | Targets | optional | Daily targets that apply while this version is the approved one. |
| `foods` | list of Food | required | At least 1, at most 500. **Every food used in `days` must be defined here.** |
| `prices` | list of Price | optional | At most 1,000. |
| `days` | list of Day | required | At least 1. At most one entry per date. |

### 4.1 Targets

| Field | Type | Req. | Rules |
|---|---|---|---|
| `kcal` | range | required | `min` must also be > 0. |
| `proteinG`, `carbsG`, `fatG`, `fibreG` | range | optional | Grams per day. |
| `fluidNote` | long text | optional | |
| `rationale` | long text | optional | Why these targets. |

### 4.2 Food

| Field | Type | Req. | Rules |
|---|---|---|---|
| `key` | slug | required | Unique within the file. **If the app already has this key:** identical values reuse the existing food. Different values create a new revision, the preview shows a field-by-field diff, and older plans and logs keep their old values. |
| `name` | short text | required | |
| `dietTag` | `veg` \| `egg` \| `chicken` \| `fish` \| `other_meat` | required | `veg` includes dairy. A mixed dish takes the tag of its most restrictive ingredient (egg fried rice → `egg`). |
| `per100g` | Per100g | required | |
| `householdMeasures` | list of `{ "label": text ≤ 60, "grams": number > 0 }` | optional | e.g. `{ "label": "1 katori", "grams": … }`. |
| `source` | text ≤ 300 | required | Where the values come from, e.g. `"IFCT 2017"` or `"Package label, <brand>, Oct 2026"`. |
| `isEstimate` | boolean | required | `true` if the values are estimated rather than taken from the source. |

**Per100g** — values per 100 g of the food, in **the same state as the grams in your meal items** (both raw/dry or both cooked).

| Field | Type | Req. | Rules |
|---|---|---|---|
| `kcal` | number ≥ 0 | required | |
| `proteinG`, `carbsG`, `fatG` | number ≥ 0 | required | |
| `fibreG` | number ≥ 0 | optional | `null` means unknown. Fibre totals for days that use this food are then shown as incomplete. |

**Never invent composition values.** If you don't know a value, find a source, or mark the food `isEstimate: true` and say in `source` how it was estimated.

### 4.3 Price

| Field | Type | Req. | Rules |
|---|---|---|---|
| `foodKey` | slug | required | Must be defined in `foods`. |
| `priceInr` | number > 0 | required | |
| `perQty` | number > 0 | required | The quantity that price buys. |
| `unit` | `g` \| `kg` \| `ml` \| `l` \| `piece` | required | |
| `gramsPerUnit` | number > 0 | required for `ml`, `l` and `piece`; must be left out for `g` and `kg` | Grams in one unit, e.g. grams per piece for eggs or bread slices, or grams per litre for milk. |
| `asOf` | date | required | The date the price was seen. Use a date on or before `startDate`. |
| `source` | text ≤ 300 | required | e.g. `"BigBasket, 12 Oct 2026"` or `"Estimate"`. |
| `isEstimate` | boolean | required | |
| `excludeFromBudget` | boolean | optional | Default `false`. `true` means this food's cost still appears in the day's cost breakdown, but it's **left out of the `budgetInrPerDay` comparison**. Use it for food that's already paid for, e.g. a protein powder bought in advance. |

**How cost is computed:**
- Price per gram = `priceInr ÷ (perQty × g-per-unit)`, where g-per-unit is 1 for `g`, 1,000 for `kg`, and `gramsPerUnit` for the other units.
- For each day, the app uses the most recent price with `asOf` on or before that date, from this file or an earlier import. If there's none, it uses the earliest later price.
  - That chosen price also decides whether the item counts toward the budget (its `excludeFromBudget`).
- **Each day gets two totals:**
  - **Day cost:** every priced item, including excluded ones. It's shown with a per-item breakdown in which excluded items are marked.
  - **Budget cost:** the day cost minus excluded items. Only this is compared with `budgetInrPerDay`.
- **A day with any unpriced item has an "incomplete" cost, never ₹0.**
- Costs are shown **rounded up** to the whole rupee.

### 4.4 Day

| Field | Type | Req. | Rules |
|---|---|---|---|
| `date` | date | required | Between `startDate` and `endDate`, and unique within the file. |
| `meals` | list of Meal | required | At least 1. |
| `expectedTotals` | ExpectedTotals | optional | Your own totals for the day. The app computes totals itself from foods × grams and warns where your value differs by more than 5%. |

**ExpectedTotals** — `kcal`, `proteinG`, `carbsG`, `fatG`, `fibreG` and `costInr`. Each is an optional number ≥ 0.
- `costInr` is compared with the full **day cost**, including items whose price has `excludeFromBudget: true`.

### 4.5 Meal

| Field | Type | Req. | Rules |
|---|---|---|---|
| `type` | `breakfast` \| `lunch` \| `pre_workout` \| `post_workout` \| `dinner` \| `snack` | required | |
| `time` | time | optional | |
| `name` | short text | required | |
| `items` | list of Item | required | At least 1. |
| `prep` | long text | optional | |
| `substitutions` | list of text | optional | Shown to the athlete as written. **They aren't checked against diet rules**, so keep them compliant. |

### 4.6 Item

| Field | Type | Req. | Rules |
|---|---|---|---|
| `foodKey` | slug | required | Must be defined in `foods`. |
| `grams` | number > 0, ≤ 5,000 | required | |
| `household` | short text | optional | e.g. `"1 katori"`. |

**List cooking oil, ghee, milk, sugar, chutneys and snacks as items with grams**, so they count toward macros and cost.

---

## 5. Diet rules

Nutrition plans are checked on import against the athlete's diet rules **in the app** (Settings → Diet rules), date by date.

**Which rules apply on a date**
- **Weekday rules** apply on that weekday. Weekdays are numbered `0` = Sunday … `6` = Saturday.
- **Date-range rules** apply from their start date to their end date inclusive.

**What a vegetarian day allows**
- `veg` is allowed.
- `egg` is allowed only if eggs are explicitly allowed. **A pending decision on eggs counts as not allowed.**
- `chicken`, `fish` and `other_meat` are never allowed.
- If two vegetarian rules apply on the same day, the stricter one wins.

**Excluded items** (e.g. onion, garlic)
- Each excluded word is matched as a whole word, ignoring case, against every item's food `name` and `key` (underscores are read as spaces).
- An ingredient hidden inside a composite dish can't be detected. **List ingredients as separate items** wherever a rule might apply.

**Any violation is an error** that names the date, meal and item, e.g. "2026-10-15 (Thu, vegetarian day) — lunch 'Chicken curry' — item `chicken_breast` is chicken". The file can't be imported until it's fixed.

---

## 6. What the import checks

**Errors** (the import is blocked):
- Invalid JSON, a file over 1 MB, or an unsupported `schemaVersion` or `kind`.
- Unknown keys, wrong types, out-of-range values, or malformed dates, times or slugs.
- Dates outside `startDate`–`endDate`, or a nutrition day repeated.
- Duplicate food keys; a `foodKey` not defined in `foods`; `gramsPerUnit` missing for `ml`/`l`/`piece` or present for `g`/`kg`.
- An unknown athleteKey, or an importer who isn't allowed to import for those athletes (§2).
- A session athlete who isn't in the plan, `joint` with fewer than 2 athletes, or `perAthlete` naming an athlete who isn't in the session.
- An unknown station key or category, or a station mentioned with no event category available.
- A range with min > max, or a `kcal` target min of 0.
- A diet-rule violation (§5).
- On approval: another approved nutrition plan for the same athlete covers any of the same dates.

**Warnings** (shown in the preview; the import is allowed):
- Computed totals differ from `expectedTotals` by more than 5%.
- The day's **budget cost** (day cost minus items whose price has `excludeFromBudget: true`) is over `budgetInrPerDay`. The gap is shown in ₹.
- A budget is set but the day's cost is incomplete because of unpriced items.
- A food's fibre is unknown.
- A food key already exists with different values (a new revision is created, and the diff is shown).
- A food's values look implausible: protein + carbs + fat + fibre over 100 g per 100 g, or kcal differing from 4 × protein + 4 × carbs + 9 × fat by more than 15%.
- **Run spike:** a planned run is more than 10% longer than the athlete's longest run in the previous 30 days. Earlier runs in the same file count toward the baseline. With no baseline, the preview says it can't assess.
- A run exercise has no `distanceM`.
- The training plan overlaps another approved training plan for the same athletes.
- The file is identical to one already imported.

**Info:**
- Dates in the range that have no sessions or meal plan.
- Cost can't be computed because of unpriced items and no budget is set.
- Which foods are excluded from the budget, with their cost per day.
- Counts of everything that will be created.

---

## 7. Versions and approval

- **Every import creates a new version** of a plan. Earlier versions stay viewable with their original file.
- **Approval:** confirming with "Import and approve", or approving later, makes that version live. The previously approved version of the same plan is archived.
- **Only approved versions** appear on Today, in the calendar and in meal logging. Drafts can be previewed but not logged against.
- **Logs stay linked:** logs keep pointing to the version they were logged against.

---

## 8. Examples

These are **format examples only**. They aren't training or nutrition advice, and the values aren't real data. Both are test fixtures and must import cleanly.

### 8.1 Minimal valid training plan

```json
{
  "schemaVersion": 1,
  "kind": "training",
  "title": "Example: minimal training plan",
  "startDate": "2026-10-14",
  "endDate": "2026-10-14",
  "athletes": ["chinmay"],
  "sessions": [
    {
      "date": "2026-10-14",
      "athletes": ["chinmay"],
      "type": "run",
      "title": "Example run",
      "blocks": [
        {
          "name": "Main",
          "exercises": [
            { "name": "Example run", "category": "run", "distanceM": 3000, "targetRpe": "3-4" }
          ]
        }
      ]
    }
  ]
}
```

### 8.2 Minimal valid nutrition plan

```json
{
  "schemaVersion": 1,
  "kind": "nutrition",
  "title": "Example: minimal nutrition plan",
  "athlete": "chinmay",
  "startDate": "2026-10-14",
  "endDate": "2026-10-14",
  "foods": [
    {
      "key": "example_food",
      "name": "Example food",
      "dietTag": "veg",
      "per100g": { "kcal": 100, "proteinG": 10, "carbsG": 10, "fatG": 2.2 },
      "source": "EXAMPLE ONLY - not real composition data",
      "isEstimate": true
    }
  ],
  "days": [
    {
      "date": "2026-10-14",
      "meals": [
        {
          "type": "breakfast",
          "name": "Example breakfast",
          "items": [{ "foodKey": "example_food", "grams": 150 }]
        }
      ]
    }
  ]
}
```

This imports with a warning that fibre is unknown, and an info note that the cost can't be computed because there are no prices.

### 8.3 Fragment: a joint station session with a per-athlete override

This isn't a complete file; it's one entry for the `sessions` list of a team plan whose `athletes` are `["chinmay", "aryan"]`.

```json
{
  "date": "2026-10-15",
  "athletes": ["chinmay", "aryan"],
  "joint": true,
  "type": "station",
  "title": "Example station session",
  "blocks": [
    {
      "name": "Main",
      "exercises": [
        {
          "name": "Sled push",
          "category": "sled_push",
          "sets": 4,
          "distanceM": 25,
          "load": { "kg": 150 },
          "restSec": 120,
          "targetRpe": "7-8",
          "perAthlete": { "aryan": { "load": { "guidance": "Lighter if form breaks" } } }
        }
      ]
    }
  ],
  "lighterOption": "Example: 2 sets instead of 4."
}
```

---

## 9. Checklist for plan authors

- [ ] `schemaVersion: 1`, the correct `kind`, and a `planKey` if this updates an existing plan.
- [ ] Every date is inside `startDate`–`endDate`; nutrition days are unique.
- [ ] Unknown values are `null` or left out, **never `0` or `""`**.
- [ ] Training: every session athlete is in `athletes`; runs have `distanceM` (per set); station exercises use a seeded station key; there's a `lighterOption` where a lighter alternative makes sense.
- [ ] Nutrition: every `foodKey` is defined in `foods`; every food has a real `source` and an honest `isEstimate`; `per100g` matches the state the grams are weighed in; oil, ghee, milk and sugar are items; prices have `asOf` ≤ `startDate`, with `gramsPerUnit` for `ml`/`l`/`piece`; anything already paid for has `excludeFromBudget: true`.
- [ ] Nutrition: no item breaks the athlete's diet rules on its date. Eggs on vegetarian days stay out until they're explicitly allowed.
- [ ] Validate against the JSON Schema in `docs/import-schema/` (`training-v1.schema.json`, `nutrition-v1.schema.json`), generated from the app's validator. It checks structure only; the cross-field rules (dates inside the plan, consistent athletes and foods, `gramsPerUnit` by unit) and the rules in §5–6 are checked by the app's import preview.
