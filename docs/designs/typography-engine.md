---
status: PLAN
slice: R1 / typography engine (E1) — steps 2-4 for the type kind
inherits: docs/designs/color-explorer.md (E1, 0E type rules, OV-2, OV-4), asset-manager-reframe.md (generic tables)
reviewed: /plan-eng-review + codex outside voice, 2026-07-22
---
# Typography engine (E1)

The second asset kind. Same index → cluster spine as colors, reusing the generic
`style_usages` / `style_clusters` tables with `kind='type'`. Extracts the four
typographic axes (family, size, weight, line-height) as literal declarations,
normalizes them, and clusters near-misses (size drift within 1px; font-family
fallback-tail dedup). Type INSIGHT queries are a follow-on slice (mirrors the
color step-5 split), not this one.

Scope is loud per OV-2: **literal declarations only** — no config resolution, no
computed type scale, no `font` shorthand. The UI labels it as such.

## Two slices (per codex C10 — refactor first, then add)

- **Slice A — generalize schema + store (no behavior change).** Kind-agnostic
  Drizzle names, a generic cluster shape, the `axis` column + index,
  purge-on-failure. Color engine adapts to it; the existing color suite staying
  green IS the regression test. Ships alone.
- **Slice B — type extraction + clustering (purely additive).** type-normalize,
  type-extract (shared walker), type-cluster, run.ts wire-in, type tests.

## Slice A — schema + store generalization

### Drizzle property renames, physical columns unchanged (codex C1)

The step-2 tables were color-named, but OV-3 mandates kind-agnostic usages. The
only readers today are the color engine + tests (no API/UI wired), so rename the
**TS-facing Drizzle property** names while KEEPING physical column names — the
code reads honest names, and there's no risky physical-rename migration:

| table | Drizzle property | physical column (unchanged) |
|-------|------------------|-----------------------------|
| style_usages | `normalizedValue` | `text("normalized_color")` |
| style_cluster_members | `value` | `text("color")` |
| style_cluster_members | `distance` | `real("delta_e")` |
| style_clusters | `maxDistance` | `real("max_delta_e")` |

Kept as honest color-only nullables: `alpha`, `neutral` (type leaves them
null/false). Per-kind cluster metadata (`{axis, metric}`) rides `params` (OV-3).

### The one additive migration (codex C3)

Add `axis text` to `style_usages` (type sub-property: family/size/weight/line-
height; null for color) + index `(source_id, kind, axis)` for axis-filtered
aggregates. Cluster uniqueness stays `(source_id, kind, key)` by **axis-prefixing
type cluster keys** (`size:13px`, `family:inter`), so no cluster-table change.
`axis` is a distinct column, NOT derivable from contextDetail: `font-size:
var(--fs)` stores contextKind=css-var-ref, contextDetail=`--fs`, axis=`size`.

### Generic cluster shape (codex C2)

`style-cluster-store` currently imports the color `NearMissCluster` and writes
color-named fields. Introduce a kind-agnostic `StyleClusterInput`:

```
StyleClusterInput = {
  key, canonical, size,
  neutral?: boolean,        // color only
  maxDistance?: number,     // ΔE (color) | px (size) | undefined
  params?: object,          // { axis, metric } for type
  members: { value, role, distance, usageCount }[]
}
```

`color-cluster` emits it (neutral set, maxDistance = ΔE, params omitted);
`type-cluster` will emit it (params = {axis, metric}). `rebuildStyleClusters`
consumes the generic shape.

### Purge-on-failure (codex C4 — also fixes a shipped color bug)

The soft stages catch a throw and mark the stage failed, but leave the previous
run's rows/clusters in place, so a failed extraction reads as stale-fresh. Per
OV-1(b), a failed style stage must purge that kind's output rows. Fix the color
stages too (they have the same latent bug) by purging the kind's usages (on
extract fail) or clusters (on cluster fail) in the stage's catch, then rethrow so
softStage still records the failure with observable counts.

## Slice B — extraction (type-extract.ts) + clustering (type-cluster.ts)

### Shared walker (DRY, my A2)

Extract `lib/indexer/style-walk.ts` from color-extract (fast-glob walk +
comment-filter + offset/declaration-region machinery). color-extract refactors
to use it; type-extract supplies only its per-line token scanner. Walks stay
per-stage (not combined) so the stages remain independently non-fatal; the 2×
file read is ~1s on cohort-live-web (upgrade path: one combined walk if the
dogfood latency budget is tight).

### Axes + normalization (type-normalize.ts, pure)

```
CSS longhand declarations + property-aware JS + Tailwind type utilities
        │
        ├── font-size    → px @ 16px root (rem/em ×16, pt ×4/3); raw unit in rawToken   axis=size
        ├── line-height  → unitless kept as ratio (0E exempt); px-unit → px               axis=line-height
        ├── font-weight  → keyword→number (normal 400, bold 700); numeric kept           axis=weight
        └── font-family  → lowercased, trimmed full stack in normalizedValue             axis=family
```

- **contextKind** reuses the color enum. **contextDetail** = the CSS property.
- **JS is property-aware only (codex C5):** extract from style-object keys
  (`fontSize: "13px"`, CSS-in-JS `font-size:` in template literals) and JSX
  `style={{...}}`; NEVER scan bare JS strings (`"16px"`, `"bold"`, `"Inter"`,
  `1.5` are everywhere and would poison the index).
- **Named-family guard:** family names extracted ONLY in `font-family` value
  position, never as loose words.
- **Tailwind type utilities** (distinct from color's): `text-{xs..9xl}`→size,
  `font-{sans,serif,mono}`→family, `font-{thin..black}`→weight,
  `leading-{none..loose,3..}`→line-height. Disambiguated from `text-{color}-
  {shade}` by an explicit size/weight/family keyword set. Recorded as
  `tailwind-named`, `normalizedValue=null` (not-scored, OV-4), so they never
  cluster or drift.
- `%`, `ex`, `ch`, `lighter`/`bolder` → recorded raw, `normalizedValue=null`
  (unresolvable literal-only gap).

### Clustering (type-cluster.ts)

Only near-miss clusters persist (exact groups are cheap aggregates for the
insight slice). Two axes cluster in v1 (0E named exactly these):

- **size** — greedy star-by-usage on normalized px. A variant links to an anchor
  iff `|Δpx| <= 1` AND the variant is **strictly less-used** than the anchor
  (codex C7: equal-popularity sizes are intentional scale steps, not drift; and
  popular steps like 13/14/16 stay anchors so they never swallow each other).
  `distance` = px diff. `params = {axis:"size", metric:"px"}`, key `size:<px>`.
- **family** — group by normalized first family; near-miss = same first family,
  differing fallback tail (`Inter, sans-serif` vs `Inter, Arial, sans-serif`).
  Canonical = most-used full stack; `distance` = null. `params =
  {axis:"family", metric:"stack"}`, key `family:<first>`.

**weight and line-height are exact-only in v1** (0E named only size + family
near-miss); no persisted clusters.

### Wire-in — run.ts

Two non-fatal soft stages after the color stages (`type-extract`,
`type-cluster`), same pattern + the purge-on-failure from Slice A.

## Tests

Slice A: the full existing color suite stays green (mandatory regression for the
rename + generic cluster shape); purge-on-failure test (a throwing stage empties
its kind's rows, does not leave stale ones).

Slice B — type-extract: per-axis from CSS longhand; unit normalization
(`0.8125rem`→13px, `13px`→13px collapse); unitless line-height stays ratio;
weight keyword→number; named-family guard (no family from prose/non-font props);
JS property-aware only (a bare `"16px"` string is NOT extracted; `fontSize:
"16px"` is); Tailwind `text-sm`=size and NOT `text-red-500`; comment/minified FP
guards inherited.

Slice B — type-cluster: size near-miss ≤1px to a strictly-more-popular anchor,
2px gap does not link, equal-count does not link; family fallback-tail dedup;
weight/line-height produce no near-miss clusters; DB round-trip through the
generalized schema incl. `kind='type'` isolation.

## NOT in scope

- **Type insight queries** (scale, drift ranking, coverage) — follow-on slice,
  mirrors color step 5. Surfacing mixed-unit equivalence as a finding (codex C8)
  lives THERE; this slice stores raw+normalized to enable it. OV-4 "named
  utilities not-scored" gets locked by the insight tests (codex C9).
- The `font` shorthand (codex C6 — needs a tokenizer; longhand only in v1).
- Tailwind config resolution to real px (OV-4 — v1.x; utilities stay not-scored).
- Weight / line-height near-miss clustering (0E named only size + family).
- letter-spacing / tracking as a fifth axis (post-v1).
- `%`/`ex`/`ch` size units, `lighter`/`bolder` weights, SCSS `$var`/`@mixin`
  resolution (recorded raw, normalized null — documented literal-only gaps).

## What already exists (reuse, don't rebuild)

- `lib/indexer/color-extract.ts` — the walker + comment-detect + region scanner;
  Slice B extracts the shared chassis into `style-walk.ts`, both kinds use it.
- `lib/indexer/color-cluster.ts` — the greedy star-by-usage shape; size near-miss
  reuses it with a 1px + strictly-less-used metric instead of ΔE.
- `lib/indexer/style-usage-store.ts` — already kind-generic (no change).
- `lib/db/queries/colors.ts` patterns — the type insight slice will mirror them.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | E1 inherited from color-explorer.md (accepted) |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ABSORBED | 10 findings, all folded; reshaped into 2 slices |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found | 6 findings (3 arch, 2 quality, 1 perf), all folded; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (engine data layer, no UI this slice) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** outside voice (high reasoning), 10 findings, zero false positives. Simplified the plan (Drizzle-property rename over physical migration; `font` shorthand descoped) and hardened it (generic cluster shape, axis indexing, purge-on-failure fixing a shipped color bug, JS false-positive guard, size near-miss tie/boundary spec). Reshaped into refactor-then-add slices.

**CROSS-MODEL:** no tension — codex refined the eng findings (its DRY-store point extends my DRY-walker point; its schema simplification supersedes my physical-rename with a lower-risk path). Both agree on kind-agnostic generalization at n=2.

**VERDICT:** ENG CLEARED — implementing Slice A (schema/store generalization, color green) then Slice B (type extraction/clustering).

NO UNRESOLVED DECISIONS
