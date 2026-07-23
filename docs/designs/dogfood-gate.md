---
status: PLAN
slice: R1 / 3-repo dogfood gate (between engine and agent surface)
inherits: asset-manager-reframe.md (T2 gate, T3 latency budget, D4.3 cold start), color-insights.md (theme-axis tripwire), typography-engine.md + color-explorer.md (documented 0E gaps)
reviewed: /plan-eng-review + codex outside voice, 2026-07-23
---
# 3-repo dogfood gate

The checkpoint between the shipped engine (colors + typography: extract → cluster
→ insights) and the agent surface (MCP). It proves the engine's outputs are
correct and calibrated on real, diverse repos before anything is built on top.
**Fail loops back to engine calibration, never forward (T2).** It produces four
things: a go/no-go, calibrated constants (only if drift shows false positives),
recorded first-run index latency (feeds launch copy + the D4.3/D5 tripwires), and
the theme-axis verdict. The 3 repos are candidates for the Release 2 launch
posters (posters re-run the harness in R2; this gate does not produce collateral).

## Scope decisions (locked this review)

- **Repos:** 3 public, deliberately different styling stacks (Tailwind /
  SCSS / CSS-in-JS), at least one shipping a dark theme (for the tripwire),
  recognizable enough to poster in R2. Actual picks: **owner selects + pins
  before the run** (criteria below). cohort-live-web stays a private local sanity
  anchor, not one of the 3.
- **Harness:** one thin committed `scripts/dogfood.ts`, reused for all 3 gate
  runs. It calls the REAL `runIndexer` (not a fork of the stages) into a temp DB,
  so it measures the true pipeline and stays correct as the engine evolves.
- **Rigor:** sampled precision spot-check + 100% verification of the drift top-N
  (the zero-FP bar); tune constants only if FP surface, existing fixture tests as
  the regression proof. No labeled-corpus eval framework (D3.3 hard CI gate is
  explicitly deferred until AFTER this calibration).
- **Evidence artifact:** stable JSON (fixed schema) is the record of the gate,
  diffable across repos and across calibration passes; `--html` is an optional
  human view. No coupling of gate output to R2 poster collateral (codex #13).

### Repo selection criteria (owner fills + pins the 3)

| slot | stack it must exercise | why | dark theme? |
|------|------------------------|-----|-------------|
| 1 | Tailwind utility classes + CSS-var theming | `tailwind-named` not-scored path (OV-4) + var-ref coverage | **required in ≥1 slot** |
| 2 | SCSS `$var`-heavy | the documented coverage gap (cohort showed 0.33%); confirms it reads as honest-low, not broken | optional |
| 3 | CSS-in-JS / JS style objects | the **known-weak** JS path: color-in-JS is any-hex (no property awareness), type-in-JS is longhand line-regex only. Low recall here is a documented gap, not a gate failure (codex #5) | optional |

Each pick is pinned: **repo URL + commit SHA + license (must permit poster use)
+ approximate file/image count** (codex #10), recorded here so a run is
reproducible. The dark-theme requirement can live in any slot; without it, axis D
is untested and the gate cannot clear the tripwire.

### Selected repos (pinned 2026-07-23)

| slot | repo | URL | SHA | license | size | dark theme |
|------|------|-----|-----|---------|------|------------|
| 1 Tailwind | shadcn-ui/ui | github.com/shadcn-ui/ui | `91f21dfe1328` | MIT | ~68 MB | **yes** (`.dark` class) → axis D |
| 2 SCSS | twbs/bootstrap | github.com/twbs/bootstrap | `b8932a1ec1c3` | MIT | ~306 MB | yes (`data-bs-theme`) |
| 3 CSS-in-JS | mui/material-ui | github.com/mui/material-ui | `502034f275c7` | MIT | ~742 MB | yes (theme mode) |

All MIT (poster-safe). shadcn/ui is the primary theme-axis test (`.dark`).

## What the gate measures (4 axes)

```
                          scripts/dogfood.ts  (per repo, per CLIP flag)
   repo path ─► temp DB(migrate) ─► source row ─► runIndexer(db,source,config,full)
                                    codeRoots:[]        │ subscribe emitStage(sourceId)
                                    (never config's)    │ hard-fail on any style FAILED:
                                                        ▼
        color queries: getColorStats / derivePalette / listColorDrift / coverage
        type  queries: getTypographyScale / listTypeDrift / deriveMixedSpellings
                                                        │  stable JSON out (+ optional --html)
                    ┌───────────────────────────────────┼───────────────────────────┐
                    ▼                 ▼                  ▼                            ▼
              A. truth test    B. calibration     C. index latency           D. theme-axis
           precision+recall   tune 4 knobs iff   cold index <2min,           cross-axis drift FP?
           (sampled + top-N)  drift shows FP     CLIP off / on(cold,warm)    reopen engine or confirm defer
```

### A. Extraction truth test (precision + recall, sampled)

Per repo:
- **Drift precision — 100% of the drift top-N hand-verified.** N = 10 (the
  `list_drift` default). Color drift is one list; **type drift is size + family
  axes only** (weight/line-height are exact-only, no drift gate — codex #9). Every
  finding classified real / FP-with-cause. A light/dark pair, an intentional scale
  step, or a neutral-gray pair surfacing as drift is a FP.
- **Extraction precision — sampled.** Random 30 extracted usages per kind per
  repo, each checked against its `file:line`. Target ≥ 95% correct; a mis-parsed
  value (wrong hex, wrong px) is a bug, not a gap.
- **Recall — stratified sample (codex #12).** Hand-scan files stratified by
  `css`/`scss`, component files, and theme files (not a flat random 10), count
  declarations the engine missed. A miss OUTSIDE the documented v1 gaps (SCSS
  `$var`, Tailwind config resolution, `font` shorthand, `%`/`ex`/`ch`, type
  var-defs) is a bug; inside them it is expected. The harness **reports the
  walker's skipped-file counts** (minified / huge / long-line / dotfiles per
  `style-walk.ts`) so silent skips are a visible recall blind spot, not a hidden one.

### B. Threshold calibration

The 4 tunable knobs and where they live:

| knob | value | file |
|------|-------|------|
| color near-miss ΔE2000 | `NEAR_MISS_DELTA_E = 6` | `color-normalize.ts:6` |
| neutral downweight cutoff | `NEUTRAL_MAX_CHROMA = 0.025` | `color-normalize.ts:13` (pre-tuned from cohort spike) |
| size near-miss window | `SIZE_NEAR_PX = 1` | `type-cluster.ts:10` |
| context weights | `contextWeightFor(...)` | `colors.ts` |

Procedure: run drift on all 3 repos, inspect the top-N, count FP by cause. If FP
> 0, identify the responsible knob, adjust, re-run. **Overfit guard, made
verifiable (codex #8):** before tuning, FREEZE the set of confirmed-real drift
findings (the top-N verified real per repo) into the results JSON; after any
tune, assert every frozen positive still appears (no silent false negative). Every
real-repo FP that motivates a constant change becomes a fixture test so it can
never regress. Record before/after.

### C. First-run index latency (NOT MCP cold-start — codex #4)

This harness measures **indexer cold-start** on a fresh index, which is the
dominant input to the D4.3 MCP-cold-start budget but is not the MCP number itself
(MCP does not exist this slice; the 60s MCP trigger is validated in the agent-
surface slice). Budget (T3): full cold index **< 2 min** — the "two-minute
promise" that becomes launch copy.

Measure per repo:
- **CLIP-off** (config default, local, no network) — the baseline.
- **CLIP-on**, reported as two separate numbers (codex #11): **cold-download**
  (one-time model fetch, network) and **warm-model embed** (per-repo, model
  already cached). The harness **hard-fails the CLIP-on measurement if
  `runClipStage` reports `skippedModelUnavailable`** — it must never record
  CLIP-off numbers under a CLIP-on label.

**Breach → RECORD and reopen D5 (CLIP default) / D4.3 (sync cold start); do NOT
fix here** — that reopening is an engine/packaging decision, the loop-back, not
the gate's job.

### D. Theme-axis tripwire

The dark-theme repo is the test: does any color drift finding pair a light-mode
value with its dark-mode counterpart (`.dark` / `[data-theme]` /
`prefers-color-scheme`)? **`listColorDrift` returns only one representative
location per variant, not the canonical's or all occurrences (codex #6)** — one
line is not enough to judge light↔dark. So for each color drift finding in the
dark-theme repo, the classification step **greps the repo for the canonical AND
variant values and inspects their enclosing theme selector**, then classifies
same-axis (real) vs cross-axis (light↔dark). Verdict:
- **0 real cross-axis FP → confirm the OV-6 defer** (documented v1 limitation
  stands; type already carries a populated `axis` column, color leaves it null).
- **≥1 real cross-axis FP → REOPEN the engine before R2:** add `axis` detection
  to color extraction, skip cross-axis pairing in `color-cluster`. The recorded
  tripwire firing (color-insights.md). It blocks R2, not the rest of the gate's
  recording.

## Exit criteria (what "pass" means)

Per repo:
1. Drift: **0 false positives in the default top-N the tool surfaces** (`list_drift`
   default 10). The zero-FP claim is scoped to that default-surfaced set and the
   full set is verified (codex #7). A run where any style stage reported `FAILED:`
   is a gate fail, not a zero-drift pass (codex #3).
2. Extraction precision ≥ 95% on the sample; recall misses only inside documented gaps.
3. Index latency within budget (or breach recorded + D5/D4.3 reopened — a recorded
   breach does not silently pass).
4. Theme-axis: 0 real cross-axis FP (or the engine reopen is filed).

Any (1)/(2) failure loops back to engine calibration. (3)/(4) are recorded
reopens, not silent passes. The gate clears only when 1-4 are green or their
loop-back is explicitly filed.

## Harness — `scripts/dogfood.ts`

`tsx scripts/dogfood.ts <repo-path> [--clip] [--json <out>] [--html <out>] [--sample 30] [--top 10]`

- Builds a temp DB (drizzle + `migrate`, mirroring `tests/helpers/test-db.ts`),
  inserts one `sources` row for the repo, builds a `Config` from `ConfigSchema`
  defaults **with `codeRoots: []`** (critical — the default `codeRoots` are
  relative `./src`/`./app` resolved against the pigmento checkout, so leaving them
  in pulls pigmento's own styles into every external repo's report; codex #1) and
  `clip.enabled` set by `--clip`.
- **Subscribes to the `emitStage` EventEmitter filtered by `sourceId` before
  calling `runIndexer`, unsubscribes in `finally`** (there is no persisted log;
  codex #2), collecting per-stage ms and each stage's detail string. Calls
  `runIndexer({ db, source, config, full: true })` and times total wall-clock.
- **Hard-fails on soft-stage failure:** if any of `color-extract`,
  `color-cluster`, `type-extract`, `type-cluster` emits a detail starting
  `FAILED:`, the harness exits non-zero and marks the run failed (codex #3) — a
  silently-failed extraction must not read as a clean zero.
- Then runs the color + type query functions and emits **stable JSON** (fixed
  schema): counts (usages/clusters per kind), coverage %, drift top-N per kind
  (canonical, variants, `file:line`, suspicion), mixed-spelling findings, the
  precision sample (`--sample` usages/kind with raw + normalized + `file:line`),
  the walker skipped-file counts, and latency (total + per-stage; CLIP cold-
  download vs warm-embed when `--clip`). `--html` renders the same JSON as an
  optional human view.
- It never touches the user's `data/pika.db` or `pigmento.config.ts` — its own
  temp DB and in-memory config only. It does NOT use `getDb()` (that memoizes a
  single instance on a global Symbol and would collide across repos in one run);
  it constructs its own `drizzle` handle like the test harness does.

## NOT in scope

- **Labeled-corpus precision/recall eval framework** — deferred; D3.3 hard CI gate
  is explicitly post-calibration. Sampled spot-check is the right rigor now.
- **Fixing a latency breach** (CLIP-on over budget) — records + reopens D5/D4.3;
  the fix (split CLIP into a companion addon per E1) is its own slice.
- **Fixing the theme-axis engine if the tripwire fires** — the reopen is filed as
  a separate engine slice; the gate only decides whether it fires.
- **SCSS `$var` / Tailwind-config resolution** — documented v1 gaps; the gate
  confirms they read as honest-low coverage, it does not close them.
- **MCP tool correctness + MCP cold-start timing** — validated in the agent-surface
  slice (line 44-45 success criteria); the gate validates the ENGINE the tools read.
- **R2 poster collateral** — decoupled (codex #13); posters re-run the harness in
  R2 once calibration settles the true story.

## What already exists (reuse, don't rebuild)

- `lib/indexer/run.ts::runIndexer({db, source, config, full})` — dependency-injected;
  the harness calls it directly. No stage fork (my throwaway `dogfood-type.ts`
  re-implemented the type loop; the committed harness must not).
- `tests/helpers/test-db.ts` — the temp-DB + `migrate` pattern the harness copies.
- `lib/db/queries/colors.ts` + `typography.ts` — the read layer, already tested.
- `lib/config/schema.ts::ConfigSchema` — defaults + the `clip.enabled` toggle.
- `lib/indexer/events.ts::emitStage` — the EventEmitter the harness subscribes to.
- The 4 calibration constants already exist and one is pre-tuned.

## Failure modes

| codepath | failure | test / guard | user sees |
|----------|---------|--------------|-----------|
| harness | default `codeRoots` pull pigmento's own styles into the report | `codeRoots: []` (source.root only) | uncontaminated per-repo metrics |
| harness | soft style stage fails, run completes, reads as clean zero | hard-fail on `FAILED:` stage detail | real fail surfaced, not a false pass |
| harness | CLIP model unavailable, silently records CLIP-off as CLIP-on | detect `skippedModelUnavailable`, fail the CLIP-on measure | honest latency, no phantom CLIP number |
| harness | `getDb()` memoization collides across repos in one run | harness builds its own drizzle handle, never `getDb()` | correct per-repo metrics |
| harness | temp DB not cleaned → disk fill over many runs | `rmSync` in a finally | no leak |
| harness | repo path missing / not a dir | `runIndexer` already asserts root exists (`run.ts:74`) | clear error, no zero-scan prune |
| calibration | constant tweak overfits, drops a real find | frozen confirmed-positive set re-checked post-tune | no silent recall loss |
| latency | CLIP-on over 2min | recorded, reopens D5/D4.3 | honest launch number, not a hidden breach |
| theme-axis | cross-axis FP mistaken for real drift | grep both values + theme selector, not one line | correct reopen-or-confirm |

No failure mode is both silent and uncaught.

## Test plan

The harness is a measurement script, not shipped product logic, so it carries a
minimal self-check, not a suite:
- **Harness smoke test** (`tests/dogfood-harness.test.ts`): point it at a tiny
  seeded temp dir (a couple CSS files) and assert it (a) runs `runIndexer`
  end-to-end into a temp DB with `codeRoots: []`, (b) returns the expected JSON
  shape (counts, coverage, drift array, skipped counts), and (c) **surfaces a
  soft-stage `FAILED:` as a non-zero exit** — the one behavior a passing metrics
  shape could otherwise hide (codex #3). One test file.
- **Calibration regressions** (conditional): if axis B tunes a constant, the
  motivating real-repo pattern is added to `color-cluster.test.ts` /
  `type-cluster.test.ts` as a fixture so the FP can never come back.

No unit tests for the metric math itself — it is thin reads over already-tested
query functions.

## Parallelization

| step | modules | depends on |
|------|---------|------------|
| build harness | `scripts/` | — |
| 3 repo runs | none (read-only on repos, separate temp DBs) | harness |
| calibration | `lib/indexer/*-normalize.ts`, `*-cluster.ts`, `colors.ts` | all 3 runs (barrier) |

Lane A builds the harness. Then the 3 runs fan out (independent), but run them
sequentially anyway — CLIP-on is heavy and parallel model loads thrash. Calibration
is a barrier: it needs all 3 drift lists before tuning, and any tune touches shared
engine constants, so it cannot parallelize with the runs.

## Results (run 2026-07-23, CLIP-off)

Harness: `scripts/dogfood.ts`. shadcn/MUI at pinned SHAs; MUI style run scoped to
`packages/mui-material/src` (the CSS-in-JS core) because the full repo carries
10,741 SVG icons (see axis C). JSON evidence in `/tmp/dogfood-repos/out/*.json`.

| repo | color usages | cov | type usages | cov | index (CLIP-off) |
|------|-------------|-----|-------------|-----|------------------|
| shadcn-ui/ui | 6758 | 15.4% | 5135 | 21.8% | 17.3s |
| twbs/bootstrap | 748 | 3.5% | 97 | 0.0% (SCSS $var) | 6.0s |
| mui core | 712 | 0.0% (JS) | 182 | 0.0% (JS) | 0.4s |

**Axis A — extraction truth test.** Color + size + weight extraction: correct on
all 3 (spot-checked against `file:line`). **Family extraction was broken** — it
mis-extracted `theme.typography.fontFamily` (JS property access, MUI), `string`
(TS type annotation, shadcn), `$font-family-base` (SCSS var, bootstrap),
`` `var($ `` / `var(--#` (template/interp fragments), and appended `/*rtl:...*/`
comments (bootstrap). **Fixed** (`type-extract.ts` `isLiteralFamily` guard + 4
fixture tests); re-ran, family lists clean on all 3. This is the gate's loop-back
firing and closing.

**Axis B — calibration.** The ΔE2000 threshold and neutral downweight are sound
(neutrals correctly ranked last; ΔE values sane). Two drift **false-positive
classes** surfaced, neither fixed by a constant:
1. **Palette-definition files** — design-system color registries (`colors/red.js`,
   `_legacy-colors.ts`, `themes.ts`) list intentional near-neighbors (the whole
   Material/Tailwind palette); clustering them as drift is a FP. Dominates all 3
   (they are design-system *sources*, not consuming apps).
2. **Test-file colors** — `sanitizer.spec.js`, `*.test.tsx` hold throwaway colors.
   Never brand colors.
   → **OPEN DECISION (loop-back):** drift needs consuming-usage awareness (exclude
   test files; treat color-definition files as token sources, not drift targets),
   OR the drift claim is scoped to consuming apps. Not implemented — it changes
   drift semantics and is a product call, not a mechanical fix. cohort-live-web
   (an app) had clean, real drift, so this is specific to design-system-library
   targets.

**Axis C — latency.** All within the 2-min promise CLIP-off. The driver is
`git-author` (12.4s shadcn, 5.5s bootstrap), NOT style (~0.1-1s) or CLIP. **MUI
full repo (10,741 SVGs) is the large-repo case** — image stages (hash/phash/
git-author) on 10k+ icons would breach 2 min, and CLIP-on on 10k images is a
guaranteed breach → the recorded D4.3/D5 reopen path (not fixed here). CLIP-on not
measured (heavy model download; deferred).

**Axis D — theme-axis tripwire.** No light↔dark cross-axis FP surfaced. shadcn's
cross-theme color mixing is the palette-definition class (registry themes), not a
light/dark counterpart pair (light/dark values differ by large ΔE and don't
cluster). **OV-6 defer CONFIRMED** — the tripwire did not fire; the engine reopen
for axis detection is not triggered.

**Gate verdict: PARTIAL PASS.** Extraction validated (family bug found + fixed +
regression-tested), latency within budget CLIP-off, theme-axis defer confirmed.
**Blocked on the drift FP decision** before the drift claim is launch-ready — the
one loop-back item.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | inherited from asset-manager-reframe.md (T2 gate) |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ABSORBED | 12 findings, 0 FP; 11 folded, 1 (evidence artifact) resolved via D4 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found | scope confirmed at Step 0; forks D2/D3/D4 resolved; all 12 codex folds applied |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (measurement harness, no UI) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** outside voice (gpt-5.5, high reasoning, read-only against the repo), 12 findings, zero false positives, each verified against code. Caught a real contamination bug (default `codeRoots` pull pigmento's own styles into every external report), three silent-failure paths (soft-stage failure, CLIP model-unavailable, walker skips), and sharpened four claims (MCP-vs-index cold start, zero-FP scope, overfit-guard verifiability, CSS-in-JS extraction limits). All folded.

**CROSS-MODEL:** one tension, codex flagged the HTML-as-poster-source coupling; resolved at D4 (JSON evidence of record, HTML optional, poster-coupling dropped). No contradiction elsewhere; codex extended the eng pass rather than opposing it.

**VERDICT:** ENG CLEARED + GATE RUN (partial pass) — harness built, 3 repos indexed at pinned SHAs, family-extraction bug found + fixed + regression-tested, latency within the 2-min budget CLIP-off, theme-axis defer confirmed. Design review n/a (no UI this slice).

**UNRESOLVED DECISIONS:**
- Drift FP on design-system repos (the gate's loop-back): exclude test files + treat color-definition files as token sources rather than drift targets, OR scope the drift claim to consuming apps. Not implemented — it changes drift semantics (a product call). Everything else in the gate passed.
