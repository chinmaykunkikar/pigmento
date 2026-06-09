# Pika — Design TODOs

Opened by `/plan-design-review` on 2026-04-24, eng-reviewed the same day. Each item is scoped to its surface; most are < 1h CC time.

Legend: **P0** = trust/bug, **P1** = systemic a11y, **P2** = design-system hygiene, **P3** = UX improvement.

## Shipping plan — 3 sequenced PRs

Eng review decided to split these into 3 PRs rather than one mega-sprint. Review and land in order:

**Prereq (bug-fix sprint):** Land items #5 and #7 from `~/.claude/plans/you-are-building-recursive-gem.md` first. #7 (apiGet/apiPost structured errors) is a hard dependency of `<ErrorState>`.

- **PR #1 — TRUST + A11Y** (~7 items, ~15 files): T1, T2, T3, T4, T5, T6, T10. The trust floor and a11y essentials. After bug-fix #7 lands, ErrorState consumes `{ status, statusText, path, message, cause? }`.
- **PR #2 — DESIGN HYGIENE** (~8 items): T7, T8a (a11y attrs only), T11, T12, T13, T14, T15, T16. Refactor-heavy, low-behavior-change.
- **PR #3 — UX FEATURES** (~5 items, structural): T9, T17, T18, T19, T20. Each is independent; can be further split if needed.

**Moved out of this file:** T21 (indexer delta reporting + toast primitive) is a Phase-N feature, not a design TODO — it requires DB schema changes. Move to the PRD next-phase list. Tracked below under "Moved to PRD".

**Split from original T8:** The original T8 proposed `role="grid"` + arrow-key navigation together. Eng review split:
- **T8a** (PR #2): add `role="grid"`, `role="row"`, `role="gridcell"`, `aria-selected`, `aria-rowcount` / `aria-rowindex` for virtualized rows. No behavior change.
- **T8b** (experiment, not a TODO yet): arrow-key keyboard nav inside the grid. Needs screen-reader testing against VoiceOver + NVDA before shipping. Documented here so it isn't forgotten.

---

## P0 — Trust and correctness

### T1. Remove phantom keyboard hints from EmptyState
`components/empty/EmptyState.tsx:52-60` advertises `⌘O` (add source) and `⌘,` (preferences) but neither is registered in `ShortcutLayer.tsx`. First-run users hit these and nothing happens. Drop both hints; leave `⌘K command palette` (the only real one advertised in this strip).

### T2. `<ErrorState>` primitive
New: `components/primitives/ErrorState.tsx`. Props: `{ message, cause?, onRetry?, retryLabel? }`. Renders the status callout in DESIGN.md § 6 with `role="alert"`, AlertTriangle icon, `[Retry]` primary button, `[Copy details]` ghost button, collapsible `<details>` for stack/HTTP body.

### T3. Wire `<ErrorState>` everywhere
Replace the silent-fail or one-liner `text-danger` paths. Full inventory of `useQuery` / mutation sites that must render `<ErrorState>`:

| Hook / mutation | Current behavior | File:line | After |
|---|---|---|---|
| `useFolder` | silent (empty state renders) | `components/Shell.tsx:55` (rendered in `AssetGrid`) | `<ErrorState>` in the grid container |
| `useSources` | silent (app treats as no-sources) | `components/Shell.tsx:26` | `<ErrorState>` at Shell level |
| `useIndexerStatus` | silent degradation | `components/Shell.tsx:39` | Passive, fine to leave silent unless repeated failure |
| `useReindex` | silent (pill stops spinning) | `components/Toolbar.tsx:52` | Toast + inline `<ErrorState>` near button |
| `useOverviewCounts` | one-liner `text-danger` | `components/overview/PostIndexOverview.tsx:54-56` | `<ErrorState>` with Retry |
| `useAsset` | one-liner `text-danger` | `components/detail/DetailDrawer.tsx:103-104` | `<ErrorState>` inside the drawer body |
| `useDispatchPlan` | inline danger banner | `components/plan/DispatchTab.tsx:155-158` | `<ErrorState>` (upgrade existing banner) |
| `useClusters` (or equiv) | no error surface | `components/clusters/ClustersView.tsx` | `<ErrorState>` |
| `useDuplicates` (exact/near) | no error surface | `components/duplicates/DupTab.tsx` + children | `<ErrorState>` |
| `useMatch` | partial (`rejectReason` only for input errors) | `components/match/MatchView.tsx` | `<ErrorState>` for server-side failures |

Total: **10 sites**. Depends on bug-fix-sprint #7 (structured error shape).

---

## P1 — Accessibility

### T4. `aria-label` on drawer asides
`DetailDrawer.tsx:65` → `aria-label="Asset detail"`. `PlanDrawer.tsx` → `aria-label="Cleanup plan"`. Without these, screen readers read "complementary region" with no context.

### T5. Live regions on async status
- `IndexingCenter` stage list → wrap in `<div aria-live="polite" aria-atomic="false">`.
- `DispatchLogViewer` streaming log → same.
- Error banners in `<ErrorState>` → `role="alert"` (handled in T2).

### T6. Drawer focus management (non-modal)
On `drawerOpen = true`: move focus to the close `IconBtn` in `DetailDrawer` / `PlanDrawer`. On close: return focus to the triggering element. Non-modal behavior is intentional per Pass 7; don't add a focus trap.

### T7. Selected-tile second signal
`AssetTile.tsx` currently signals selection via `shadow-tile-selected` (accent glow) alone. Colorblind users see no difference. Add a 14px `Check` glyph in the top-right corner of a selected tile using `bg-accent text-white rounded-xs`.

### T8a. AssetGrid semantics (PR #2, a11y attrs only)
`AssetGrid.tsx`: add `role="grid"` on the container, `role="row"` on virtualization rows, `role="gridcell"` on tiles, `aria-selected` on each cell, `aria-rowcount={totalRows}` on the container, `aria-rowindex` per row. **No keyboard-nav behavior change in this task.** Screen readers that expect all rows in DOM will announce wrong position; virtualization's `aria-rowindex` compensates. Verify against VoiceOver + NVDA before merging.

### T8b. AssetGrid keyboard grid navigation (EXPERIMENT, not yet a TODO)
Arrow-key navigation inside the virtualized grid (Home/End, PageUp/PageDown, arrow keys). Interacts with `@tanstack/react-virtual`, existing click handlers, selection state. Estimated > 1 day CC. Requires screen-reader testing pass. Document here so it's not forgotten; don't schedule until T8a ships and VoiceOver behavior is understood.

### T9. Graceful collapse below 1024px (see DESIGN.md § 11)
- Sidebar collapses to icon-rail (`w-12`), folder tree hidden.
- Toolbar filters wrap to a second row.
- DetailDrawer and PlanDrawer become full-screen Radix Dialogs below 768px.
- One-time dismissible banner: "pika is a desktop tool. Some views may be cramped below 1024px."

---

## P2 — Design system hygiene

### T10. ~~Replace inline `style={{ boxShadow }}` with shadow-* utility classes~~ — REJECTED
**Do not do this.** Attempted during PR #1, caused a Chrome compositing-layer bug where the plan drawer rendered visibly on-screen when the detail drawer opened. See DESIGN.md § 3 for the full explanation. The inline `style={{ boxShadow }}` on `DetailDrawer`, `PlanDrawer`, and `ActionBar` is load-bearing — keep it as inline style.

### T11. Tokenize `border-l-[3px]` status stripe
Either add `--border-status: 3px` to `globals.css` and use `border-l-(--border-status)` OR pick `border-l-0.5` (2px). Normalize to one value across:
- `components/plan/DispatchTab.tsx:140, 155, 183`
- `components/match/MatchView.tsx:113, 425`

### T12. Align micro-radii to tokens
Replace `rounded-[1px]` / `rounded-[2px]` with `rounded-xs` (2px token) in:
- `components/duplicates/NearPair.tsx:75, 81, 116, 132, 159`
- `components/duplicates/HammingHistogram.tsx:27`
- `components/empty/EmptyState.tsx:20`

If `rounded-[1px]` is genuinely desired (histogram bars, decorative grid cells), add a `--radius-px: 1px` token and name it.

### T13. Off-grid heights → tokenized heights
- `components/tree/SourceSwitcher.tsx:28` — `h-[30px]` → `h-7` (28) or `h-8` (32). Pick per the CLAUDE.md control-height contract (24/26/28/32).
- `components/duplicates/ExactTab.tsx:55,62` + `components/detail/SizePips.tsx:27` — `h-[26px]` → `h-6.5` (Tailwind v4 supports fractional).

### T14. Big-number token or class
`components/duplicates/NearPair.tsx:71` uses `text-[28px]`. Either add `text-2xl` to `@theme` (with lh/weight/tracking) or demote to `text-xl` (20px). Decide; document in DESIGN.md § 3.

### T15. Icon size + stroke normalization
Current spread: 6 sizes (10/11/12/13/14/16), 6 stroke widths (1.5/1.75/2/2.25/2.5/3) across 88 usages. DESIGN.md § 3 tightens to **3 sizes (14/12/10)** and **2 strokes (1.5/1.75)**. Grep for off-spec uses and refactor. High-leverage files to start: `Toolbar.tsx`, `Overview.tsx`, `DetailDrawer.tsx`, `Sidebar.tsx`.

### T16. `.bg-checker` utility
Add to `globals.css`:
```css
.bg-checker {
  background-image:
    linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%),
    linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%),
    linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%);
  background-color: var(--color-checker-a);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
```
Replace the duplicated inline block in:
- `components/detail/AssetPreview.tsx:5`
- `components/duplicates/NearPair.tsx:12`
- `components/duplicates/DupGroup.tsx:15`
- `components/grouped/VariantTile.tsx:10`
- `components/grid/AssetTile.tsx:12`

---

## P3 — UX improvements

### T17. Overview in the view switcher
`components/Toolbar.tsx:162-178`: add Overview as the first item in the `Segmented`. Pick an icon (`Home` exists in `icons.tsx`). Remove the `view === "overview" ? "grid" : view` hack. Users should see Overview as a first-class destination.

### T18. Split re-index modality (Pass 1 decision)
- First-ever index of a source → full-screen `IndexingCenter` (current behavior).
- Re-index of an already-populated source → bottom strip along the main content area showing stages + ETA. Main views remain interactive. Affected rows get a subtle "stale" badge (TBD).

This is structural; scope with care. One option: start with a cheaper intermediate — keep modal but add a visible "Browsing paused while we rebuild the index" line + elapsed time.

### T19. First-visit copy for Clusters and Match
When `lastIndexedAt === null`:
- `ClustersView.tsx` empty: "Clusters group visually similar assets. Re-index this source to populate. [Re-index]"
- `MatchView.tsx` empty: already has a drop card; add "Run an index first so matches have something to compare against" when no asset count exists.

### T20. Post-dispatch "Re-index to refresh"
`components/plan/DispatchTab.tsx` → `DispatchResultCard`: when `mode !== "dry-run"`, the success card gets a trailing "Re-index to refresh →" button that calls `useReindex`. Without this, the user dispatches, their files change, and the index is stale with no nudge.

### T21. ~~Re-index delta reporting~~ → MOVED TO PRD NEXT-PHASE
Originally surfaced in Pass 7 of the design review. Eng review identified this as a feature, not a design TODO: it requires indexer-emitted `{ scanned, added, dropped, unchanged }` **and DB persistence of the delta per run**, plus a brand-new toast primitive. Out of scope for design sprint. **Move this to the PRD's next-phase list** (when PR #3 UX FEATURES lands, reopen with full scope).

Summary of what was proposed:
- Indexer emits delta per run; persist to a `index_runs` table (or extend `sources.lastRun`).
- `PostIndexOverview` header: "Last run: +14 new, -3 removed, 2 moved".
- StatusBar transient toast: "Index updated · 3 removed, 14 added" (ok-bg, 4s auto-dismiss).
- Dependency: toast primitive (Radix Toast is allowed — part of the Radix family already in CLAUDE.md's allowlist).

---

## Post-audit engineering TODOs

Added by /plan-eng-review on 2026-06-10 after the full-codebase audit. The fix sweep itself (matching guards, MAD calibration, background indexing, dispatch persistence, rename safety, vitest harness, deletion batch) is tracked in the eng-review tasks artifact, not here. These are the items deliberately left out of that sweep.

### E1. Revalidate persisted plans against the live index
`draftPlan` persists to localStorage as frozen assetId/relPath snapshots (`lib/store.ts:329` does the same for cartIds). A full reindex reassigns ids and pika's own rename changes relPath under a queued plan, so dispatch can hand an agent stale paths. Fix at the dispatch chokepoint (and on PlanDrawer open): re-resolve each item, remap by contentHash where possible (content survives reindex), and surface a "stale item" state for the rest. Needs a small UX decision (flag vs drop vs remap), which is why it isn't a sweep rider. Lower urgency once the purge stage is gone (ids get more stable). Start at `lib/plan/build.ts` + the dispatch route's plan load.

### E2. Rasterization v2 (the real white-collapse fix) — TRIGGER: after the sweep's hygiene columns ship and a measurement baseline exists
The sweep's entropy guards EXCLUDE degenerate illustrations; v2 makes them matchable again. Scope: adaptive density from viewBox (~512px target), `sharp.trim()` whitespace crop, hash the alpha/coverage channel when the flattened greyscale is near-uniform (mean>245), render-large-then-area-downsample for the 9x8 dHash, `fit:'contain'` for CLIP. Bump a phash version column so reindex recomputes only stale rows. Golden-file test set required. Benefits phash, clustering, and CLIP simultaneously.

### E3. Embedding model evaluation (SigLIP / DINOv2 via transformers.js) — TRIGGER: only if calibrated CLIP still underperforms after E2
Re-measure the corpus baselines after E2 + the MAD gate. If white-cluster separation is still poor, evaluate SigLIP base (better-calibrated baseline) or DINOv2-small (structure-sensitive, suits line art). Full re-embed required; thresholds must be re-measured against the pinned-revision corpus fixtures from the sweep.

### E4. Sub-quadratic phash clustering — TRIGGER: corpus >10k same-ext assets
`cluster-phash.ts` compares all pairs with BigInt hamming (~1.14us/pair measured): ~57s of blocked CPU at 10k, ~15min at 40k. Store phash as two 32-bit ints, XOR+popcount lookup, band candidates by 16-bit prefix (LSH) or BK-tree. Invisible at the current ~1.5k corpus; do not build early.

## Color Explorer follow-ups — deferred by /plan-ceo-review (2026-06-10)

Full context: `~/.gstack/projects/chinmaykunkikar-pika/ceo-plans/2026-06-10-color-explorer-design-language-debugger.md`

### CE-1. Palette poster export (P2, effort S; CC ~0.5-1d)
**What:** One-click PNG/SVG export of the repo's color identity (brand palette, drift ring, coverage score, repo name), OG-card sized, small pika mark.
**Why:** The launch screenshot as a product feature; every user who posts one is distribution. Deferred to the week after launch (ceremony decision E4); the render endpoint composes data that already exists; sharp is already a dependency.

### CE-2. `pika check` CI mode (P2, effort M; CC ~2d)
**What:** Headless engine reuse in CI: fail the build when a diff introduces colors/type off the established palette, with readable messages ("#1366a8 is 1.2 ΔE from brand.blue — use var(--color-accent)").
**Why:** Completes clean-up-then-stay-clean; the team-adoption feature (ceremony decision E5). Schema door already held open: persist palette baselines. Depends on: color engine shipped, baseline persistence.

### CE-3. Tailwind config resolution for the coverage score (P2, effort M; CC ~2-3d)
**What:** Resolve the target repo's Tailwind theme (jiti for v3 JS configs, @theme parsing for v4) so named utilities map to real values, the "not scored" bucket folds into the tokenization score, and utility-based drift becomes detectable.
**Why:** The CEO review's outside-voice pass (OV-4) excluded named utilities from the v1 score to keep it unfalsifiable; this is the recorded path to completing it. Depends on: v1 score shipping with the labeled bucket.

## Deferred — documented, not in this sprint

These are real but out of scope for the design-gap sprint. Listed so they don't rot:

- **Plan history** — DispatchLogViewer is live-only. Past plans aren't browsable. Revisit when multi-session cleanup is real.
- **Asset tagging/labels** — out of PRD scope.
- **Dark mode** — codified in DESIGN.md § 12 as MVP-light-only. Tokens don't block it. Revisit post-usage.
- **Filesystem watcher** — passive `relativeTime()` in Re-index tooltip is current. Could escalate to `text-warn` after a threshold. Borderline feature.
- **Hover-peek on tiles** — current is click-to-open. Add if drawer flow feels heavy.
- **Preferences screen** — `⌘,` advertised (to be removed, T1). When prefs exist: theme toggle, default sort, hotkey customization.
- **Agent-handoff richness** — design-source `agent-handoff.jsx` shows per-action dependency notes + confidence bars. Current PlanItemCard is more compact. Polish candidate.
- **Removed-asset audit view** — Pass 7's "option C" (orphan rows in a Removed tab). Heavy feature; revisit only if users ask.
