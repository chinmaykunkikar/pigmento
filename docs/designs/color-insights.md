---
status: PLAN
slice: R1 / color engine / step 5 (insight queries)
inherits: docs/designs/color-explorer.md (Next Steps step 5), asset-manager-reframe.md (MCP contracts)
reviewed: /plan-eng-review + codex outside voice, 2026-07-22
---
# Step 5 — Color insight queries

The read layer over the tables from the step 2-4 engine (`style_usages`,
`style_clusters`, `style_cluster_members`). Turns raw usages + near-miss
clusters into the four answers a human or agent reads: brand palette, drift
ranking, coverage score, most-used/one-offs. Pure precomputed reads, no
extraction/clustering at request time (DESIGN principle 4). This is the data
layer the MCP tools (`get_palette`, `list_drift`) and the R2 Colors view sit on.

## Data flow (revised: one aggregate, many derived views — codex C5)

```
style_usages (kind='color')                    style_clusters + style_cluster_members
        │  ONE GROUP BY pass                       (near-miss only; neutral flag,
        ▼                                           maxDeltaE, per-member usageCount)
   getColorStats(db, sourceId)                              │
     perColor[]  (count, distinctFiles,                     ▼
                  weightedUsage, opaqueCount)         listColorDrift(db, sourceId)
     buckets     (tokenized/literal/def/notScored)     suspicionScore() + neutral downweight
     definedVars (var → color)                         suggestedToken (most-REFERENCED var; hex fallback)
     varRefs     (var → ref count)                     representative file:line (BATCHED, kind='color')
        │  pure derivations                                 │
        ├── getColorPalette (brandScore rank, top-N)        │
        ├── mostUsed / oneOffs (by usageCount)              │
        └── getColorCoverage (bucket math)                  │
             └──── MCP get_palette / list_drift (R1) + Colors view (R2) ────┘
```

## Files

- `lib/db/queries/colors.ts` — `getColorStats` (the single aggregate),
  `listColorDrift`, and exported pure derivations/scorers (`brandScore`,
  `contextWeightFor`, `suspicionScore`, `coverageBuckets`, `derivePalette`).
  Pure/impure split mirrors `color-cluster.ts` (pure) vs `style-cluster-store.ts`
  (DB): the scorers take plain data and are unit-tested without a DB. Split the
  file if it crosses 400 lines.
- `lib/queries/keys.ts` — add `palette(sourceId)`, `drift(sourceId)`,
  `coverage(sourceId)` keys. Every key carries `sourceId` (codex C8) so the
  Colors view never cache-collides across sources.
- `tests/color-insights.test.ts` — rides the vitest harness on seeded rows.

Typography (E1) gets its OWN insight queries (size scale, family dedup), NOT
these — colors and type share the generic TABLES, not the insight layer. Do not
genericize the scorers (over-abstraction at n=1; the design proves kinds one at
a time).

Every DB read filters `kind = 'color'` (codex C7): the tables are shared with
typography/strings, so an unscoped `normalized_color IN (...)` would leak other
kinds' rows.

## getColorStats — the single aggregate

One pass over `style_usages WHERE sourceId AND kind='color'`, grouped by
`normalized_color`, with per-context sub-counts. Returns:

- `perColor[]`: `{ color, usageCount, distinctFileCount, weightedUsage,
  opaqueCount, contexts: Record<contextKind, count> }` for every non-null
  normalized color. `distinctFileCount = COUNT(DISTINCT rel_path)`.
  `weightedUsage = Σ contextWeightFor(kind, detail) × alphaFactor` (codex C4/C6).
- `buckets`: `{ tokenized, literal, definitions, notScored }` counts (below).
- `definedVars`: `Map<varName, {color, defCount}>` from `css-var-def` rows.
- `varRefs`: `Map<varName, refCount>` from `css-var-ref.contextDetail` — powers
  both the suggested-token tie-break and unresolved-var detection.

Palette / most-used / one-offs / coverage are pure derivations of this object,
not separate DB passes.

### brandScore (codex C4/C6)

`brandScore = log1p(weightedUsage) × distinctFileCount`, where
`weightedUsage = Σ perUsageWeight` and
`perUsageWeight = contextWeightFor(contextKind, contextDetail) × (alpha<1 ? 0.4 : 1)`.

Summing per-usage weight handles one color appearing across many contexts
(instead of picking an arbitrary "dominant" row) and folds the alpha downweight
in for free, so translucent shadows/overlays don't read as brand identity.

`contextWeightFor(contextKind, contextDetail)` (heuristic, calibration knob):

| weight | rule |
|--------|------|
| 1.0 | `css-var-def`; `css-decl` with detail ∈ {color, background, background-color, fill, accent-color}; `tailwind-arbitrary` prefix ∈ {bg, text, fill} |
| 0.6 | `js-literal`; other `tailwind-arbitrary`; `css-decl` stroke |
| 0.3 | `css-decl` with detail ∈ {border*, outline, box-shadow, text-shadow, column-rule} |
| 0.5 | `svg-attr`, unknown |

`most-used` = perColor by `usageCount`; `one-offs` = `usageCount === 1` tail.

## getColorCoverage — var-reference coverage (codex C2)

| bucket | contextKinds | role |
|--------|-------------|------|
| tokenized (numerator) | css-var-ref that RESOLVES to a defined color var | references a color token instead of hardcoding |
| literal (denominator) | css-decl, js-literal, svg-attr, tailwind-arbitrary | raw hardcoded color |
| unresolvedVars (EXCLUDED, informational) | css-var-ref whose var is not defined-as-color in the index | non-color var (`var(--space-4)`) or foreign/library var |
| definitions (EXCLUDED) | css-var-def | the token's own definition — neither drift nor a reference |
| not-scored (labeled, EXCLUDED from %) | tailwind-named | OV-4: config resolution deferred to v1.x |

`pct = tokenized / (tokenized + literal)`; `null` when the denominator is 0.

Build-time correction to codex C2: the extractor records `var(--x)` as
`css-var-ref` for EVERY var in a CSS value position, not just color ones, so
counting all refs as tokenized would inflate the score with `var(--space-4)`.
So a ref counts as tokenized ONLY when it resolves against a `css-var-def` this
index knows to be a color (the same `definedVars` map the token suggester uses).
Unresolved refs (non-color vars, or foreign/library vars defined outside the
scanned root) go to `unresolvedVars`, excluded from both numerator and
denominator — counting them as broken would be its own false positive. Resolved
refs also fold into their color's brand-inference usage, so a token referenced
5000× reads as a 5000-use brand color, not a 1-use definition. Measured on
cohort-live-web: 4967 resolved / 4327 literal → 53.4% (226 unresolved, 135
defs, 2 not-scored all correctly excluded).

Excluding `css-var-def` is load-bearing: cohort-live-web has 135 css-var-def +
5193 css-var-ref; counting the 135 definitions as literals would tank the most-
tokenized repo's score.

## listColorDrift — suspicion-ranked near-miss

Reads the persisted near-miss clusters (computed at index time; this is pure
read + sort). Per cluster:

- `suspicionScore` rewards the clear-accidental-drift shape: high-usage
  canonical + low-usage variant + small ΔE. `neutral` clusters are downweighted
  below all chromatic clusters (the dogfood learning, now consumed).
- `suggestedToken` (codex C3, recorded E2 tie-break): among `definedVars` whose
  color equals the canonical, pick the var with the highest `varRefs` count;
  surface ties as a choice; fall back to the canonical hex when no var defines
  it. Never emit a var that isn't defined (zero-FP bar).
- representative `file:line` per variant, BATCHED: one
  `style_usages WHERE sourceId AND kind='color' AND normalized_color IN
  (<all variant colors>)` (no N+1), preferring a scoreable literal row with a
  non-null line, then stable `relPath, line, col` (codex C7). SVG rows have
  `line = null`.

## Tests (tests/color-insights.test.ts)

Pure scorers (no DB): brandScore ordering (brand-context high-usage-many-files >
one-off border); contextWeightFor (background 1.0 > border 0.3); alpha
downweight (opaque > translucent, same context); suspicionScore (neutral cluster
ranks below an equal-shaped chromatic one); coverageBuckets (css-var-def
excluded, tailwind-named not-scored, 200 var-ref + 2 literal ≈ 99%, zero usages
→ null); unresolvedVars counts refs with no def.

DB round-trip (seeded style_usages + style_clusters via test-db real migrations):
getColorStats aggregate correctness (distinctFileCount, weightedUsage,
buckets); listColorDrift order + suggestedToken resolves to the most-referenced
var when css-var-def rows exist and falls back to hex when absent; kind='color'
isolation (a seeded kind='type' row with a colliding normalized string must not
leak); empty source → empty/null, no crash.

## NOT in scope

- **Theme-axis awareness (OV-6) — deferred to documented v1 limitation (codex
  C1).** Step 2-4 shipped without an axis column, so clusters are paired axis-
  blind; a `.dark` vs `:root` counterpart could read as drift. Deferred because
  pika is light-mode-only and the design pre-authorized "an explicit limitation
  note" here. **Dogfood tripwire:** if the 3-repo gate surfaces real cross-axis
  false positives, this reopens step 2-4 (add `axis` to `style_usages`, detect
  in extraction, skip cross-axis pairing in clustering) before R2. AWAITING
  owner confirm (defer vs reopen now).
- Fix action / plan-format v2 (step 7, its own slice).
- Typography insight queries (E1 — reuses the tables, not these scorers).
- Config-resolved Tailwind coverage (OV-4 — v1.x; named utilities stay a
  labeled not-scored bucket).
- Resolved-token-validity coverage (v1.x — needs foreign-var awareness; v1 ships
  var-reference coverage + an informational unresolved count).
- Per-area "dialect" rollup (design step 5 stretch — defer).
- The MCP server + tool wrappers (later R1 step; these queries are the data it reads).
- Persisted/materialized insight columns (query-time GROUP BY on indexed columns
  is cheap at ~500 colors / ~5k usages; revisit only if dogfood shows pain).

## What already exists (reuse, don't rebuild)

- `lib/db/queries/overview.ts` — the aggregate-count pattern (count/sum/distinct
  at query time, source-scoped). getColorStats mirrors it.
- `lib/db/queries/duplicates.ts` — the cluster → members → usage-count-Map →
  assemble pattern is DIRECTLY the shape listColorDrift needs; copy it.
- `lib/queries/keys.ts` — query-key factory (source-scoped keys); add three.
- step 2-4 tables + indexes (`style_usages_norm_idx` covers the GROUP BY).
- `color-normalize.ts` — `isNeutral` already computed the neutral flag at index
  time; ranking just reads it. `alpha` column already stored (powers C6).

## Failure modes

| codepath | failure | test | error handling | user sees |
|----------|---------|------|----------------|-----------|
| getColorStats | empty source (no colors) | yes | returns empty perColor/zero buckets | empty palette, coverage N/A |
| getColorCoverage | denominator 0 | yes | `pct = null` | "N/A", not 0%/100% or NaN |
| listColorDrift | canonical has no defining var | yes | hex fallback | hex suggested, not a bogus var |
| listColorDrift | all-neutral clusters | yes | ranked last, still returned | grays at bottom, not dropped |
| getColorStats | kind collision on shared table | yes | `kind='color'` filter | no typography leakage |

No failure mode is both silent AND uncaught.

## Parallelization

Sequential — one query file + one test file, no independent workstreams.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | inherited from asset-manager-reframe.md |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ABSORBED | 8 findings; 7 folded, 1 (theme-axis) deferred w/ tripwire |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found | 6 findings (3 arch, 2 quality, 1 perf), all folded; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (data layer, no UI this slice) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** outside voice (high reasoning) found 8, zero false positives. Caught two recorded decisions the eng pass missed (E2 var tie-break, var-reference overclaim), one real simplification (single `getColorStats` aggregate), and one shipped-code gap (OV-6 theme-axis absent from step 2-4). All folded except the theme-axis deferral.

**CROSS-MODEL:** no tension — codex sharpened and extended the eng findings rather than contradicting them (its coverage finding complements the eng pass's css-var-def exclusion; both tighten the same score).

**VERDICT:** ENG CLEARED — plan ready to implement once the theme-axis deferral is confirmed. Design review n/a (no UI this slice).

**UNRESOLVED DECISIONS:**
- Theme-axis (OV-6): defer with documented v1 limitation + dogfood tripwire (recommended) vs reopen step 2-4 now to add axis tagging. Reverses a recorded CEO decision, so awaiting owner confirm.
