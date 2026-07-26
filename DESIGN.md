# Pika — Design System

The product spec. Tokens, patterns, principles. Implementation contract lives in `app/globals.css @theme` and `components/primitives/*`. If a decision isn't here, it isn't a decision.

Engineering-scoped rules (imports, file size, commands) live in `CLAUDE.md`. This file is *design only*.

---

## 0. R2 direction (locked 2026-07-25)

The R2 reskin adopts **Instrument White**, replacing the warm-paper "tool-grade" register. The design-language sections below (Voice, Principles, Tokens, accent rule, Accessibility, restated) have been rewritten to Instrument White as of the token-foundation slice. The IA-dependent sections (Surface inventory, Keyboard) are rewritten to the kind-routed IA as of the IA-restructure slice. Where anything below still conflicts with this block, this block wins.

**Aesthetic base.** Minimal white, modern, finished. Near-white surfaces, soft-shadow depth instead of warm-paper borders, tight geometric sans, one restrained cool accent, tabular mono for numerics. A restrained ascii/dither signature (dithered coverage ramps, dotted hairlines, mono readouts) is the only brand texture. Light mode only.

**Minimalism is a hard constraint, not a preference.** The default state of every surface is calm and sparse. Show the answer, not the instrument panel. Depth, controls, and dense data are opt-in, revealed when the user reaches for them, never all on screen at once. No cockpit. If a surface feels busy, that is a bug, not density done right. This deliberately corrects the Pika mistake of putting everything in the user's face at once.

**Progressive disclosure is the default interaction model.** A surface opens showing the single most important thing. Secondary data, filters, and tools appear on intent (hover, click, expand, a "go deeper" affordance), not on load. Prefer one clear number or object over a grid of everything.

**Editorial as seasoning, never the dish.** Editorial confidence (a large number, one confident line of copy, generous air) is allowed as an accent on the pushed surfaces (poster, first-run, overview home). It must never tip a working surface into the full magazine register. When in doubt, quieter.

**Weighting.** Value is received without asking; the browsable app is the "go deeper" destination, not the front door. Spend the visual confidence on the pushed surfaces (poster, first-run) and keep the app itself quiet.

### Locked R2 decisions (appended as forks resolve)

- **Aesthetic (2026-07-25):** Instrument White, per the block above.
- **Type (2026-07-25):** `Hanken Grotesk` (sans, UI and display) + `DM Mono` (mono, the signature texture: paths, hashes, counts, coverage ramps, drift readouts). Two faces only; hierarchy comes from weight and size, not a third display face. Scale register: **Balanced** (body 14px, hero number 60px, comfortable spacing), calm by default without going sparse. Pushed surfaces (poster, first-run, overview hero) scale up for air. Exact `@theme` token values land in the build slice.
- **Color (2026-07-25):** Monochrome / ink. The product chrome is achromatic: pure-neutral (zinc-range) surfaces and an **ink accent** (near-black, working value `#18181b`) that carries the single "you are here / do this" role (selection, primary action, focus ring, mark dot, coverage ramp). **This reframes the pre-R2 accent rule: the accent is no longer a brand hue.** The only chroma on screen is the data: the repo's extracted palette swatches and the functional semantic families (`ok`/`warn`/`danger`/`info`/`cluster`/`citron`), which stay colored because they are signals. Achromatic chrome maximizes contrast for the colors the tool exists to reveal, and removes the old accent-vs-`info` overlap. Working neutrals from the demo (surface `#fff`, bg `#fafafa`, sunken `#f0f0f1`, ink `#18181b`, text-2 `#71717a`, text-3 `#a1a1aa`, hairline `#ececed`); semantic hexes and every color-on-color pair finalized to WCAG AA in the build slice. Whether the poster and wordmark carry any brand hue is revisited in the poster fork; the app itself stays achromatic.
- **Motion (2026-07-25):** Crisp base. Fast, functional, confirming: hover/press 120-170ms, entrance 170-200ms, ease-out; exits shorter than entrances. No decorative motion in the working views. One reserved **signature beat**: after an index completes, the overview hero number counts up (0 to coverage %) and the coverage ramp fills block by block. The signature is hero-only, never sprayed across the UI. No `prefers-reduced-motion` in v1 (A8). Easing and duration tokens finalized in the build slice.
- **Overview home layout (2026-07-25):** Identity band + peer rows. Top band: the brand palette as the identity hero with a one-line coverage verdict (the coverage number plus "the rest are literals sitting next to the tokens they should use"). Below: three calm kind rows (Colors, Typography, Images), each showing its headline metrics and a go-deeper affordance; the rows are the progressive-disclosure entry into each kind view. Poster download sits in the top bar. The three kinds read as peers with the palette as the shared identity. This is the indexed `/`; the never-indexed first-run is its own fork.
- **Colors view + insight-kind pattern (2026-07-25):** Palette-first browser. A coverage strip on top (the number, the ramp, tokenized/literal/unresolved counts); the palette as a grid of copyable color cards (swatch, hex, usage count, distinct files, click-to-copy with toast) as the main content; drift as a calm section below (top near-misses with suggested `var(--token)` and file:line, "go deeper" to the full ranked list). Progressive disclosure: a color opens per-color detail; the drift list expands. **This is the pattern the Typography view inherits**, with a type specimen in place of the palette grid and mixed-spelling/type drift in place of color drift.
- **Typography view (2026-07-25):** Inherits the insight-kind frame (coverage strip on top, drift section below). Content zone is a **scale ladder**: the detected sizes rendered at their actual sizes, largest to smallest, each annotated with size / weight / usage, read as a specimen sheet rather than a label list. Families and weights show as chips in the coverage strip. The clean-verdict state (delight pack) replaces the drift section when there are zero mixed spellings. The per-kind content zone is allowed to differ from Colors (scale ladder vs palette grid) because the data differs; the shared frame (coverage strip, drift-below, monochrome, copy affordances) keeps the kinds a family.
- **Images view (2026-07-25):** Stat-strip navigation. A summary strip whose actionable counts (assets, duplicate groups, unused, clusters, variant groups) double as navigation into the preserved sub-views (grid, duplicates, clusters, variants, match); the asset grid is the default content. Issue counts (duplicates, unused) render in the danger family to draw the eye. Match is a small tool / drop-target in the strip, not a count. Reskinned tiles: a faint neutral checker behind the asset preview (which keeps its own color, chrome stays achromatic), mono filename, dims and size, ref count (`0 refs` in danger), colorblind-safe badges (text plus color) for duplicate, cluster, and zero-ref. Completes the three peer kinds.
- **First-run home (A7) (2026-07-25):** Promise + ghosted overview. The never-indexed state IS the overview home, ghosted: dashed palette placeholders under the "Design identity" label, a promise line ("Point pigmento at a repo. See the design system it actually has."), and the three add-source entries (drag folder, paste path, CLI). On index it morphs in place, no screen swap: swatches resolve to the real palette (staggered), the promise becomes the coverage verdict with the count-up signature, the entry block collapses and the three peer rows expand. **Collapse/expand animates `grid-template-rows` (0fr↔1fr) with an overflow-hidden inner, never `max-height`/`padding`** (avoids layout thrash). Structural continuity between the empty and populated states is the whole point of the morph.
- **Poster (CE-1) (2026-07-25):** Palette-dominant. Seven full-bleed color bands (the repo's brand palette, each labeled with its hex) fill the card, with a single ink bar carrying the mark dot, repo name, coverage plus drift count, and the `pigmento` wordmark. Maximum color impact and stop-scroll value; doubles as a copyable palette reference. The ground stays monochrome (the ink bar) so the palette is the only color, consistent with the app. Server-composed via `sharp` at OG dimensions (1200x630), one-click download from the overview, and emitted by the CLI for the launch-kit famous-repo posters. The editorial-ink and receipt-card compositions are candidates for additional CLI formats later, not the primary.

**All seven R2 design forks are now resolved (2026-07-25). This block is the design brief; the build slices below implement it and then this file's sections 1-13 get rewritten to match.**

---

## 1. Voice

Instrument White. Minimal, modern, finished. The chrome is quiet and achromatic; the only color on screen is the data the tool exists to reveal. The interface shows the answer, not the instrument panel.

Target user: design-system engineers cleaning up a token set, frontend leads auditing drift across a monorepo, solo developers asking "what does our design system actually look like?" They reach pigmento to *receive* their design identity, then go deeper only when they choose to.

Emotional goal: **calm, clear, confident**. A surface opens showing one important thing. Progress is visible, every action has a definite outcome, and nothing is on their face that they did not ask to see.

What pigmento is **not**:
- Not a cockpit. No wall of controls, no everything-at-once. Depth is opt-in. (This is the Pika mistake, corrected.)
- Not SaaS-marketing filler. Editorial confidence is spent only on the pushed surfaces (poster, first-run, overview hero), never on a working view.
- Not warm or decorative. No paper texture, no brand-hue accent, no gradients, no illustrations, no emoji.

---

## 2. Principles

1. **Minimalism is a hard constraint.** The default state of every surface is calm and sparse. If a surface feels busy, that is a bug. Show the answer; reveal depth on intent.
2. **Progressive disclosure is the interaction model.** A surface opens on the single most important thing. Secondary data, filters, and tools appear on hover, click, or a "go deeper" affordance, never on load.
3. **Tokens first, brackets last.** If a value isn't in `@theme`, add it to `@theme` before using it.
4. **The accent is ink.** `--color-accent` (`#18181b`) is the only "you are here / do this" signal: selection, single primary action, focus, mark dot, coverage ramp. The only chroma on screen is the data (palette swatches) and the functional semantic families.
5. **Precomputed, never lazy.** No spinners past initial load. Views read indexed DB shape.
6. **Weight the pushed surfaces.** Value is received without asking. Spend visual confidence on the poster and first-run; keep the browsable app quiet.

---

## 3. Tokens (authoritative: `app/globals.css`)

### Color

The chrome is achromatic (a pure zinc ramp). The only chroma on screen is the data: the repo's extracted palette swatches and the functional semantic families.

**Surfaces — depth stack** (always move inward as UI nests deeper; never skip levels)

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#fafafa` | App shell, outermost layer behind all panels |
| `--color-surface` | `#ffffff` | Panel face — sidebars, cards, drawers, modals |
| `--color-sunken` | `#f0f0f1` | Recessed chrome inside a surface — toolbar, input bg, sidebar header |
| `--color-sunken-2` | `#e4e4e7` | Deepest well — asset tile bg, nested inset, selection tint |
| `--color-hover` | `#f4f4f5` | Universal hover overlay for rows, tiles, tree nodes |

**Text — four ink weights** (use in order; `text-4` is ghost ink, disabled/empty-state only)

| Token | Hex | Use |
|---|---|---|
| `--color-text` | `#18181b` | Primary — filenames, labels, body |
| `--color-text-2` | `#52525b` | Secondary — file paths, asset type, descriptions |
| `--color-text-3` | `#71717a` | Tertiary — timestamps, counts, placeholders, kbd hints |
| `--color-text-4` | `#a1a1aa` | Ghost — disabled fields, empty-state hints |

**Borders — hairlines** (R2 pairs these with soft elevation shadows below; borders no longer carry all separation alone)

| Token | Hex | Use |
|---|---|---|
| `--color-border` | `#ececed` | Hairline — panel edges, row dividers, card outlines |
| `--color-border-2` | `#d4d4d8` | Strong — focus rings, drag targets, active selection |
| `--color-divider` | `#f4f4f5` | Subtle internal — section separator inside a card |

**Accent — ink** (the single "you are here / do this" color; achromatic, no longer a brand hue)

| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#18181b` | Base — active nav, primary CTA, source-indicator dot, mark dot, focus ring, coverage ramp |
| `--color-accent-hover` | `#09090b` | Hover/pressed of any accent-filled element |
| `--color-accent-bg` | `#e4e4e7` | Tinted selection fill (paired with `accent-text` plus an ink edge). Same value as `sunken-2`: selection is a whisper fill, not a loud tint |
| `--color-accent-text` | `#18181b` | Text on `accent-bg` |
| `--color-on-accent` | `#ffffff` | Text on `accent` base (e.g. primary button label) |

**Semantic — one color per state.** Never mix roles. Each family has `base / bg / text` slots, tuned to WCAG AA:

| Family | base / bg / text | Means |
|---|---|---|
| **ok** | `#15803d` / `#dcfce7` / `#166534` | Success, ready, safe — daemon ready, scan done, success toast |
| **warn** | `#b45309` / `#fef3c7` / `#92400e` | Pending, stale, needs attention — DROPPED chip, queued items, stale index. Use as text/icon on `warn-bg`, never solid fill |
| **danger** | `#dc2626` / `#fee2e2` / `#991b1b` | Destructive, unused, irreversible — `0 refs` chip, delete, CANONICAL marker on dupes, errors |
| **info** | `#2563eb` / `#dbeafe` / `#1e40af` | Match, preview, external link — Match tab highlight, "Preview migration", info callouts. Ink = "do this", blue = "look at this" — never use info for primary nav |
| **cluster** | `#7c3aed` / `#ede9fe` / `#5b21b6` | Grouping/relatedness — CLUSTER chip, grouped-view cluster count, cluster-membership indicator. Never as a generic accent |

**Citron — quantity chip only** (raw "here is a number you should see" signal — not "good", not "bad"; carried over from the pre-R2 palette unchanged)

| Token | Hex | Use |
|---|---|---|
| `--color-citron` | `#e8ec3a` | Fill for `×3 cluster`, `312 dupes`. Chips/badges only — never full-width bg, never primary button (no hover/focus defined) |
| `--color-citron-ink` | `#1a1c00` | The only text color allowed on a citron fill (passes contrast) |
| `--color-citron-muted` | `#b8bc00` | Inline text variant — when full citron is too loud for body copy |

**Other**

| Token | Hex | Use |
|---|---|---|
| `--color-checker-a/-b` | `#ffffff` / `#f1f1f2` | Asset-preview transparency checker. Infrastructure only — never reuse |
| `--color-preview-dark` | `#18181b` | Solid ground for white / light-stroke assets that vanish on the checker |
| `--color-overlay` | `rgba(24,24,27,0.4)` | Dialog/drawer scrim |

Contrast floor: WCAG AA (4.5:1 text, 3:1 UI). Every new color-on-color pair must be verified before shipping. `text-3` and `text-4` are for tertiary/ghost roles (timestamps, placeholders, disabled) and are not held to the 4.5:1 body-text floor; any count or label a user must read uses `text-2` or darker.

### Type

Hanken Grotesk for UI and display. DM Mono for paths, hashes, counts, coverage ramps, drift readouts, kbd, and anything structural (the signature texture). Two faces only; hierarchy comes from weight and size, not a third display face. Loaded via `next/font` in `app/layout.tsx` (`--font-hanken` / `--font-dm-mono`), referenced by `--font-sans` / `--font-mono` in `@theme`.

Scale register: **Balanced** — body 14px, hero number 60px, calm by default without going sparse.

| Token | Size | LH | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `text-3xs` | 10px | 13 | 500 | — | Tiny labels (badges) |
| `text-2xs` | 11px | 14 | 500 | — | Meta (kbd caption) |
| `text-xs` | 12px | 16 | 500 | — | Captions, table-meta, mono paths |
| `text-sm` | 13px | 18 | 450 | — | Dense UI |
| `text-base` | 14px | 21 | 400 | -0.06px | Body default |
| `text-md` | 15px | 22 | 500 | -0.1px | Emphasized body, section labels |
| `text-lg` | 18px | 24 | 600 | -0.15px | Subheaders |
| `text-xl` | 22px | 28 | 600 | -0.25px | Page titles |
| `text-2xl` | 30px | 34 | 600 | -0.4px | Section hero |
| `text-3xl` | 40px | 42 | 600 | -0.6px | Overview identity display |
| `text-hero` | 60px | 58 | 600 | -0.8px | Pushed-surface count-up, poster |

Numeric columns always use `tabular-nums`.

### Radius

R2 grows corners toward the finished, modern feel.

| Token | px | Use |
|---|---|---|
| `rounded-xs` | 4px | Badges, small chips, histogram bars |
| `rounded-sm` | 6px | Default controls, inputs |
| `rounded-md` | 8px | Cards, tiles |
| `rounded-lg` | 12px | Panels, drawers, dialogs, posters |

Pills use the built-in `rounded-full`.

### Shadows

R2 uses **soft-shadow depth**. Neutral (zinc) shadows only, never warm, never colored. Borders still do close-range separation (hairlines between rows); shadows carry elevation (a panel sitting above the page). This replaces the pre-R2 "no elevation shadows; borders carry everything" rule.

| Utility | Use |
|---|---|
| `shadow-xs` | Chips, buttons — a 1px lift |
| `shadow-sm` | Cards, tiles at rest |
| `shadow-md` | Raised panels, popovers, dropdowns |
| `shadow-lg` | Drawers, dialogs, floating pills |

Functional shadows (`shadow-drawer`, `shadow-floating`, `shadow-tile-selected`, `shadow-variant-selected`) remain for their specific surfaces; the selection shadows are now ink.

**Exception — drawer + floating shadows MUST stay inline `style={{ boxShadow: "var(--shadow-drawer)" }}`.** `DetailDrawer`, `PlanDrawer`, and `ActionBar` each need inline shadow because it forces the element into its own compositing layer. Without that layer promotion, Chrome breaks the CSS `translate` property on sibling absolute-positioned elements during transitions — the second drawer's `translate-x-full` silently fails to apply and it renders visibly on screen. Inline `style` may reference the new tokens via `var(--shadow-drawer)`; it stays inline (not a className) to keep the compositing-layer promotion. The other shadow utilities (`shadow-tile-selected`, `shadow-variant-selected`) are fine as classNames because those elements aren't siblings competing for the same compositing layer.

### Motion

**Crisp base.** Fast, functional, confirming. Ease-out; exits shorter than entrances.

Shared curves: `--ease-out-quart` (general), `--ease-out-quint` (drawers), `--ease-out-expo` (overlay entry). Durations live on the components:
- Hover/press: 120–170ms, `ease-out-quart`
- Entrance (overlay, drawer, row): 170–200ms, `ease-out-expo` / `ease-out-quint`
- Exit: shorter than entrance (~120ms)
- Success flash: 200ms, `flash-highlight` keyframe

No decorative motion in the working views. **One signature beat**, hero-only: after an index completes, the overview hero number counts up (0 → coverage %) and the coverage ramp fills block by block. Never sprayed across the UI.

Per A8, v1 ships **no bespoke `prefers-reduced-motion` variants**. The global `@media (prefers-reduced-motion: reduce)` block in `globals.css` is kept as a free OS-respecting safety net that zeroes CSS transition/animation durations; the signature count-up is JS-driven (rAF) and short, so it plays regardless.

### Iconography

Lucide (`lucide-react`), re-exported per-icon from `components/icons.tsx`.

| Size | Use |
|---|---|
| 14px | Default content icons, main action buttons |
| 12px | Secondary/dense contexts (toolbar pills, tight rows) |
| 10px | Badges, chips, kbd hint icons |

| Stroke | Use |
|---|---|
| 1.5 | Default |
| 1.75 | Dismissal (X, Clear), stronger signal when needed |

Don't introduce new sizes or weights without updating this table. Anything outside (11/13/16 px; strokeWidth > 1.75) needs a comment explaining why it's off-scale.

### Checker background (transparency preview)

Any surface rendering a preview of a potentially-transparent asset uses the `.bg-checker` utility in `globals.css`. Do NOT inline the `linear-gradient()` string per component.

Used in: `AssetPreview`, `AssetTile`, `VariantTile`, `NearPair`, `DupGroup`.

---

## 4. Chrome heights (design contract, never override)

| Surface | px | Tailwind |
|---|---|---|
| Toolbar | 44 | `h-11` |
| StatusBar | 24 | `h-6` |
| Sidebar | 260 | `w-65` |
| DetailDrawer | 400 | `w-100` |
| PlanDrawer (DispatchPanel) | 380 | `w-95` |
| MatchFinder left | 440 | `w-110` |
| AssetPreview panel | 200 | `h-50` |
| Tile min | 100 | `h-25` |
| Control heights | 24 / 26 / 28 / 32 | `h-6` / `h-6.5` / `h-7` / `h-8` |
| Row surfaces | 24 / 36 / 44 | `h-6` / `h-9` / `h-11` |

If a design wants something off this scale, escalate before padding.

---

## 5. The accent rule

`--color-accent` (`#18181b`, ink) appears ONLY on:
1. Currently selected items (tile outline, tree row left bar, tab underline, segmented-control active, radio dot)
2. The single primary action on any given screen — fill `bg-accent` + `text-on-accent` (white)
3. Focus rings (`focus-visible:ring-1 ring-accent/40`)
4. The dot in the pika mark, source-indicator dots, and the coverage-ramp fill

Never as decoration. Never as a hover color (use `accent-hover` for the hover/pressed state of accent-filled elements). Never on an icon unless the icon signals selection. One accent per view, at most.

For selection states where a full ink fill is too heavy, pair `bg-accent-bg` (`#e4e4e7`) with `text-accent-text` (the tinted-row treatment) plus an ink edge.

In R2 the accent is ink, not a hue, so it never competes with the data. The only chroma on screen is the extracted palette and the functional semantic families. The accent is the only "do this / you are here" signal. Other named families cover other meanings, never overlap:
- `info` (blue) — observe/preview/links: Match tab, "Preview migration", external link icons. Ink = "do this", blue = "look at this".
- `ok` — success/ready (daemon ready, scan done). Never for selection.
- `warn` — pending/stale (DROPPED chip, stale index). Text/icon on `warn-bg`, never solid fill.
- `danger` — destructive/unused (`0 refs` chip, delete, CANONICAL marker).
- `cluster` — grouping only (CLUSTER chip, cluster-membership indicator). Never a generic accent.
- `citron` — quantity chip only (`×3`, `312 dupes`). Always with `citron-ink`. Chips/badges only.

---

## 6. Status pattern (warn / danger / ok)

Semantic tokens are used via pair: `text-X` + `bg-X-bg`.

**Warning callout** (not-ready, stale, soon):
```
border border-border border-l-[status-width] border-l-warn bg-warn-bg
text-warn font-mono text-xs
```

**Error callout** (error, rejected, failure):
```
border border-border border-l-[status-width] border-l-danger bg-danger-bg
text-danger font-mono text-xs
```

**Success callout** (written, done, applied):
```
border border-border border-l-[status-width] border-l-ok bg-surface
+ ok-bg badge for the status word ("Written", "Done")
```

`[status-width]` is currently `border-l-[3px]` in code; tokenize as `--border-status-width: 3px` in globals.css and use `border-l-(--border-status-width)` or a custom utility.

---

## 7. State matrix

Every query-backed surface must specify five states:

| State | Pattern |
|---|---|
| **Loading** | Inline `text-sm text-text-3` "Loading …" on initial mount only. No skeletons. `isFetching` refresh is silent. |
| **Empty** | Use `EmptyState`-style component: explanatory body + one primary action. No "No items found." terminals. |
| **Error** | `<ErrorState>` primitive: danger banner with cause, [Retry] primary, [Copy details] ghost, collapsible `<details>` for stack. Matches Status pattern § 6. |
| **Success** | The data itself. |
| **First-run** | Only surfaces where user has *never* indexed. Explain what the view is *for*, offer a re-index CTA. |

Where the matrix is incomplete today: see `TODOS.md`.

---

## 8. Surface inventory

Asset kinds are App Router routes; the URL is the source of truth for the active kind (`/`, `/images`, `/colors`, `/typography`). `Shell` is shared chrome mounted once by `app/layout.tsx` and wraps every route; each route page renders only its kind content. The sub-view *inside* Images (grid / clusters / match) stays in the zustand store, not the URL.

| Surface | File | Purpose |
|---|---|---|
| Shell | `components/Shell.tsx` | Shared chrome + gating (loading / error / empty / first-index); mounts Sidebar, Toolbar, drawers; renders the active route |
| Toolbar | `components/Toolbar.tsx` | Kind nav (route-based), search + filters (Images grid only), Plan, Re-index |
| Sidebar | `components/Sidebar.tsx` | Source switcher + folder tree |
| Overview home | `app/page.tsx` → `components/overview/OverviewHome.tsx` | `/` — identity band (`IdentityBand`: palette hero + count-up coverage verdict) over Colors/Typography/Images peer rows (`KindRows`). Reads `/api/identity` (`getDesignIdentity`). Count-up signature fires on index completion via `store.signaturePending`. First-run ghost + in-place morph (A7) is a follow-up slice; today first-run still uses `EmptyState` |
| Images | `app/images/page.tsx` | `/images` — sub-view switch (grid / clusters / match), backed by `store.imagesView` |
| Colors | `app/colors/page.tsx` | `/colors` — palette browser (placeholder via `KindPlaceholder`; view built in a later slice) |
| Typography | `app/typography/page.tsx` | `/typography` — type specimen (placeholder via `KindPlaceholder`; view built in a later slice) |
| Grid | `components/grid/AssetGrid.tsx` | Virtualized asset tiles |
| Clusters | `components/clusters/ClustersView.tsx` | Grouped variants + near-dup browser |
| Match | `components/match/MatchView.tsx` | Drag/drop lookup by signature |
| Duplicates | `components/duplicates/DupTab.tsx` | Exact + near-pair tables |
| Indexing | `components/indexing/IndexingCenter.tsx` | Live pipeline status |
| DetailDrawer | `components/detail/DetailDrawer.tsx` | Selected-asset metadata + references (global overlay) |
| PlanDrawer | `components/plan/PlanDrawer.tsx` | Cleanup plan → prompt → dispatch (global overlay) |
| ActionBar | `components/actions/ActionBar.tsx` | Floating bottom pill, selection → plan (global overlay) |
| CommandPalette | `components/CommandPalette.tsx` | `⌘K` keyboard-first nav |
| EmptyState | `components/empty/EmptyState.tsx` | First-run / no sources |

The `StatusBar` referenced in earlier drafts is not a mounted surface; count/bytes/path live in the Images `BreadcrumbBar`.

---

## 9. Keyboard surface (discoverable via `⌘K`)

The number keys map to the **kinds** (route nav), matching the primary IA. Images sub-views are reached inside `/images` via the sub-view control or the palette's Images group, not top-level number keys.

| Combo | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘F` | Focus search (Images grid) |
| `⌘B` | Toggle sidebar |
| `` ` `` | Overview home (`/`) |
| `1` | Images (`/images`) |
| `2` | Colors (`/colors`) |
| `3` | Typography (`/typography`) |
| `4` | Toggle plan drawer |
| `b` | Cycle preview backdrop |
| `Esc` | Close drawer / palette / clear selection |

Every shortcut that is advertised in UI (EmptyState hint strip, CommandPalette hints) must be registered in `ShortcutLayer.tsx`. Advertised-but-missing shortcuts erode trust; enforce in review.

---

## 10. Accessibility baseline

- WCAG AA minimum on every text/icon pair and UI-component border.
- **Dialogs (modal)**: `AddSourceDialog`, `RenameDialog`. Use Radix Dialog — focus trap on open, focus returns on close, add explicit `aria-labelledby` + `aria-describedby`.
- **Drawers (non-modal)**: `DetailDrawer`, `PlanDrawer`. No focus trap, no scrim. On open → focus moves to the close button. On `Esc` → closes + focus returns to the triggering element. Tab flows drawer content → main grid (does NOT cycle inside drawer). This preserves the "click another tile to swap drawer content" workflow.
- Tree items use `role="treeitem"`, `aria-selected`, `aria-expanded`.
- Live regions on async ops: re-index progress → `aria-live="polite"`, error banners → `aria-live="assertive"`.
- Icon-only buttons always have `aria-label`.
- Selection state conveyed by *at least two* signals (color + icon OR color + text) — never color alone.
- Per A8, v1 authors no bespoke reduced-motion variants; the global `prefers-reduced-motion` block stays as an OS-respecting safety net (see § 3 Motion).

---

## 11. Responsive

Target viewport floor: **1024 × 720** (laptop). Below that, show a dismissible banner: "pika is a desktop tool; some views may be cramped." Don't attempt a full mobile redesign; this is a developer workspace.

What should hold below 1024:
- Sidebar collapses to icon rail (`w-12`, folder tree hidden).
- Toolbar wraps filters onto a second row, not squished.
- DetailDrawer is full-screen modal instead of side panel.
- PlanDrawer is full-screen modal.

Above 1024, the chrome heights + widths from § 4 are exact.

---

## 12. Light-only for MVP

Dark mode is a later phase. Don't build a dark token set now, but don't encode anything (raw hex, `text-white` literals, hard-coded `#fff` / `#000`) that would block it. All colors through tokens.

---

## 13. Principles, restated

> Minimal by default. Progressive disclosure. The accent is ink. Precomputed, never lazy. Weight the pushed surfaces.

When a design decision is unclear, consult this file. If the answer isn't here, fix *this file* first, then the code.
