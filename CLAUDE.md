# Pika — project instructions

Local-first developer tool that indexes image/icon assets across a codebase, groups duplicates, shows references, and (eventually) hands a cleanup plan off to a coding agent that opens a PR.

**Full PRD**: `/Users/chinmay/.claude/plans/you-are-building-recursive-gem.md` — read before starting any non-trivial change.

**Dogfood target**: `~/Tribe/cohort-live-web` (Nuxt project, rich asset surface). Point the first real index at this.

## Design Context

### Users

Design-system engineers cleaning up an icon library before shipping a new token set, frontend leads auditing asset bloat in a monorepo, and solo developers asking "is there already an icon for this?" before adding another. All three sit in front of this screen for extended stretches during cleanup work — dense data grids, reference lists, and duplicate groups being their primary surfaces. They reach for pika when an existing tool (IDE file tree, Figma, CLI optimisers) can't give them a *map* of the assets and their relationships.

### Brand Personality

Tool-grade, warm-neutral, single-accent. The interface whispers — chrome gets out of the way, the data and the relationships between files are the content. Emotional goal across a long cleanup session: **clear, focused, satisfying** — the user can see progress, every action has a definite outcome, and nothing surprises them. Visual language is close to a developer IDE or a high-end terminal, not a SaaS dashboard or a consumer productivity app.

### Aesthetic Direction

- **Theme scope:** light mode only for MVP. A dark palette may land as a later phase; do not design-double tokens now, but don't encode assumptions that would block it later either.
- **Palette** (authoritative in `app/globals.css @theme`): warm paper neutrals across a four-level depth stack (`bg #f5f3ef` → `surface #faf9f6` → `sunken #edeae4` → `sunken-2 #e4e1da`), with `hover #e8e5df` as the universal interactive overlay. Ink in four weights (`text #18160f` → `text-4 #b0ada6`). Borders are hairlines (`border #e0ddd8`, `border-2 #ccc9c2`, `divider #eae7e2`) — there are no elevation shadows in this system; borders carry all separation work.
- **One accent colour:** Slate Teal `#1c7a74` (with `accent-hover #166860`, `accent-bg #e6f4f3`, `accent-text #124f4b`, `on-accent #ffffff`). Reserved strictly for: currently-selected items, the single primary action on any given screen, the dot in the pika mark, and focus rings. Never decorative, never a hover-only colour, never on an icon unless it signals selection.
- **Semantic families — one colour per state.** Each has `base / bg / text` slots and exactly one role:
  - `ok` `#2d8a52` — success, ready, safe (daemon ready, scan complete, success toast). Never use for selection.
  - `warn` `#a07800` — pending, needs attention, stale (DROPPED chip, queued items, stale index). Use as text/icon on `warn-bg`, never as a solid fill.
  - `danger` `#b03a2e` — destructive, unused, irreversible (`0 refs` tag, delete actions, CANONICAL marker on duplicate groups, errors).
  - `info` `#3b6cd8` — match / preview / external links / informational callouts (Match tab highlight, "Preview migration" action). Distinct from accent: teal = "do this", blue = "look at this".
  - `cluster` `#7a4ad9` — grouping / relatedness only (CLUSTER tag chip, grouped-view cluster count, cluster-membership indicator). Never as a generic accent.
  - `citron` `#e8ec3a` — high-visibility quantity signal only ("×3 cluster" chip, "312 dupes" status count). Never means "good" or "bad". Always pair fill with `citron-ink #1a1c00` (the only combination that passes contrast). `citron-muted #b8bc00` is the inline-text variant. Chips/badges only — never a primary button, never a full-width background.
- **Surfaces:** hairlines, not cards. 1px `border-border` between regions. No gradients. No decorative shadows anywhere except the detail drawer's edge shadow.
- **Type:** Inter for UI, JetBrains Mono for paths, hashes, counts, kbd hints, and anything structural. Per-size line-height, weight, and tracking come from `tokens.jsx` and are wired into `@theme` modifiers (`--text-<size>--line-height` etc.).
- **Density:** 4px grid everywhere; fixed chrome heights (24/26/28/32 for controls, 24/36/44 for surfaces) are design contracts, not suggestions.
- **What it is not:** not SaaS-marketing (no hero type, no gradient CTAs, no feature grids), not Figma-chrome (no dark default, no floating purple accents), not Storybook-doc (no centred prose), not consumer-friendly-rounded (no pastel, no emoji, no illustrations).

### Accessibility

**WCAG AA contrast is the baseline.** Every text/icon/border pair must hit 4.5:1 for text and 3:1 for UI components. When introducing any new colour-on-colour combination (accent on accent-bg, warn on warn-bg, text-3 on sunken, etc.) verify contrast before shipping. Keyboard navigation, reduced-motion, and colour-blind-safe duplicate signalling (icon + text always paired with colour) are not hard requirements for MVP but are aligned with the rest of the design philosophy and should be considered on the way in rather than retrofitted.

### Design Principles

1. **Tokens first, brackets last.** Before writing any class that names a colour, size, font, or radius, check whether the token already exists in `@theme`. If it's in `tokens.jsx` but not in `@theme`, fix that first. Bracket-arbitrary values (`text-[10px]`, `max-w-[360px]`) are reserved for genuinely off-scale one-offs and require a reason.
2. **Chrome whispers, data speaks.** Fixed surface heights, hairline borders, mono for structure, sans for narrative. Never add decoration that competes with the content grid, the reference list, or the duplicate table.
3. **The accent rule is inviolable.** `--color-accent` (Slate Teal `#1c7a74`) appears only on selection, single primary action, the dot in the mark, and focus. If you reach for it for emphasis, you have chosen the wrong component or the wrong hierarchy. The other named families (`info`, `cluster`, `citron`, `ok`, `warn`, `danger`) each cover exactly one state — never reach for a semantic colour for decoration.
4. **Precomputed, never lazy.** Every UI query reads from indexed DB shape. If a view needs a number that isn't in the schema yet, extend the indexer first — don't compute-at-request-time. This shows up visually as no spinners past initial load.
5. **Information density beats prettiness.** Users spend hours in this interface. The right answer is almost always *fit more on screen without sacrificing legibility* — tighter rows, mono-aligned numerics, hairline dividers — not pad-and-card it into a marketing screenshot.

## Stack (verified 2026-04-22; re-check current before any phase start)

- **Node 24 LTS**
- **pnpm 10.33.1** (package manager)
- **Next.js 16.2.4** App Router, TypeScript strict
- **TypeScript 6.0.3** (no `baseUrl` in tsconfig; `paths` resolve relative to the config file)
- **React 19.2.5**
- **Tailwind CSS v4.2.4** (CSS-first config, no JS config file)
- **Radix Primitives** for Dialog, Popover, DropdownMenu, Slider, Tabs, Tooltip
- **`cmdk`** for command palette
- **`lucide-react`** for UI chrome icons (NOT for the indexed assets, which are user-owned)
- **`drizzle-orm` 0.45** + **`drizzle-kit` 0.31** for SQLite access and migrations
- **`better-sqlite3` 12.9.0** + WAL (driver under Drizzle)
- **`@tanstack/react-query` v5** for all client-side server state
- **`zustand` 5** for UI-only client state (selection, toggles, open/closed), not React Context
- **`sharp` 0.34** (dims, SVG raster, phash), **`xxhash-wasm`** (content hash)
- **`@tanstack/react-virtual`** (any list > 200 rows)
- **`fuse.js`** + SQLite FTS5 (search)
- **`zod` 4** (config + API validation)
- **`commander`** (CLI), **`tsx`** (runner), **`jiti`** (TS config loader), **`p-limit`** (bounded concurrency)
- **Biome 2.4** (lint + format, single tool)

**Version policy**: Pins above are what was current at last install. Before a new phase or major dep bump, run `npx npm-check-updates` and check `gh api /repos/:owner/:repo/dependabot/alerts`. If either shows drift, bump first and flag the delta to the user. Don't pin to what a stale plan doc says just because it's written down.

## Keep docs current — use Context7

Before writing code against any library, framework, or SDK, query Context7 (`resolve-library-id` then `query-docs`) for current docs. Training data lags. Use Context7 for:
- New syntax or API surface (Tailwind v4 changed arbitrary-value syntax; Next.js 16 changed a few conventions; Drizzle's query API evolves)
- Version-specific behavior (`/vercel/next.js/v16.2.2`, `/wiselibs/better-sqlite3/v12.6.2`)
- Anything you'd otherwise Google ("how to X in Y")

Only skip Context7 for pure language features (plain TypeScript, vanilla JS, SQL) or for things you've just confirmed in the same session.

Do NOT add: Base Web, styled-components, emotion, styletron, CSS Modules, Vanilla Extract, ESLint, Prettier, Prisma, raw SQL helpers that bypass Drizzle.

## Install notes

- **sharp on Node 24**: If libvips is installed globally via Homebrew (`brew install vips`), sharp builds from source and fails. Set `SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install`.
- **pnpm approves**: pnpm 10 blocks native postinstalls by default. `package.json` declares `pnpm.onlyBuiltDependencies: ["better-sqlite3", "sharp", "esbuild"]`.
- **Security overrides**: `package.json` `pnpm.overrides` forces patched transitives: `esbuild >=0.28.1` (drizzle-kit's legacy `@esbuild-kit/*` loader), `protobufjs >=7.6.3` and `@protobufjs/utf8 >=1.1.1` (onnxruntime via `@huggingface/transformers`), `postcss >=8.5.10` (pinned inside next), `adm-zip >=0.6.0` (onnxruntime-node). Revisit each when its parent updates.

## Styling rules (Tailwind v4)

### Tokens live in `app/globals.css` via `@theme`

```css
@import "tailwindcss";

@theme {
  /* colors — generate bg-*, text-*, border-* utilities */
  /* surfaces: depth stack bg → surface → sunken → sunken-2; hover is universal */
  --color-bg:           #f5f3ef;
  --color-surface:      #faf9f6;
  --color-sunken:       #edeae4;
  --color-sunken-2:     #e4e1da;
  --color-hover:        #e8e5df;
  /* text: four ink weights, use in order */
  --color-text:         #18160f;
  --color-text-2:       #524f48;
  --color-text-3:       #878480;
  --color-text-4:       #b0ada6;
  /* borders: hairline / strong / subtle internal */
  --color-border:       #e0ddd8;
  --color-border-2:     #ccc9c2;
  --color-divider:      #eae7e2;
  /* primary accent — Slate Teal: selection, primary CTA, focus, mark dot */
  --color-accent:       #1c7a74;
  --color-accent-hover: #166860;
  --color-accent-bg:    #e6f4f3;
  --color-accent-text:  #124f4b;
  --color-on-accent:    #ffffff;
  /* semantic — ok / success / ready */
  --color-ok:           #2d8a52;
  --color-ok-bg:        #eaf5ee;
  --color-ok-text:      #1d5c36;
  /* semantic — warn / pending / stale (text on bg, never solid fill) */
  --color-warn:         #a07800;
  --color-warn-bg:      #faf4e0;
  --color-warn-text:    #6b5000;
  /* semantic — danger / destructive / 0-refs */
  --color-danger:       #b03a2e;
  --color-danger-bg:    #fbeae8;
  --color-danger-text:  #7a2820;
  /* semantic — info / match / preview / external links (NOT primary nav) */
  --color-info:         #3b6cd8;
  --color-info-bg:      #eef3fe;
  --color-info-text:    #2a53b0;
  /* semantic — cluster / grouping (CLUSTER chip only) */
  --color-cluster:      #7a4ad9;
  --color-cluster-bg:   #f2edfc;
  --color-cluster-text: #522fa0;
  /* semantic — citron / quantity chip only (×3, 312 dupes); pair with citron-ink */
  --color-citron:       #e8ec3a;
  --color-citron-ink:   #1a1c00;
  --color-citron-muted: #b8bc00;

  /* fonts — generate font-sans, font-mono */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

  /* type scale — generate text-xs, text-sm, text-base, text-md, text-lg, text-xl */
  --text-xs:   11px;
  --text-sm:   12px;
  --text-base: 13px;
  --text-md:   14px;
  --text-lg:   16px;
  --text-xl:   20px;

  /* radius — generate rounded-xs, rounded-sm, rounded-md, rounded-lg */
  --radius-xs: 2px;
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* spacing base stays at default 0.25rem (4px); every h-N/w-N/p-N accepts any integer */
}
```

Tokens auto-generate utilities: `bg-surface`, `text-accent`, `border-border`, `font-mono`, `text-base`, `rounded-sm`.

### Spacing scale is dynamic — use plain numbers, not brackets

v4 generates `h-N`/`w-N`/`p-N`/`m-N`/`gap-N` for any integer N off the `--spacing: 0.25rem` base (4px). Multiply your px value by 0.25 to get N.

| px | utility |
|---|---|
| 4 | `h-1` |
| 8 | `h-2` |
| 24 | `h-6` |
| 36 | `h-9` |
| 44 | `h-11` |
| 100 | `h-25` |
| 200 | `h-50` |
| 260 | `w-65` |
| 400 | `w-100` |

Only reach for `h-[37px]` when the value is genuinely off the 4px grid (almost never; if a design has one, push back on the design).

### Arbitrary values — v4 syntax

```html
<!-- CSS variable reference: parentheses (auto-wrapped in var()) -->
<div class="bg-(--color-accent)">

<!-- Literal arbitrary value that isn't on-scale: square brackets -->
<div class="grid-cols-[1fr_2fr_1fr]">

<!-- Setting a custom property inline: square brackets -->
<div class="[--local-gap:1rem] p-(--local-gap)">
```

Old `bg-[--x]` syntax is gone. Parens for CSS var references, brackets for literals + inline prop-setting.

### Hairlines, not cards

- `border-b border-border` between regions, not rounded cards with shadows
- No `shadow-*` utilities anywhere except the detail drawer border
- No gradients

### Fixed chrome dimensions

| Surface | px | utility |
|---|---|---|
| Toolbar | 44 | `h-11` |
| StatusBar | 24 | `h-6` |
| Sidebar | 260 | `w-65` |
| DetailDrawer | 400 | `w-100` |
| DispatchPanel | 380 | `w-95` |
| MatchFinder left | 440 | `w-110` |
| AssetPreview panel | 200 | `h-50` |
| Tile min | 100 | `h-25` |

Never override. If a design looks cramped, the design is wrong and we escalate, not pad.

### The accent rule

`--color-accent` (`#1c7a74`, Slate Teal) appears ONLY on:
1. Currently selected items (tile outline, tree row left bar, tab underline)
2. Primary action buttons (one per screen) — fill with `bg-accent` + `text-on-accent` (white)
3. Focus rings
4. The dot in the pika mark and source-indicator dots

Never as decoration. Never as a hover color (use `accent-hover` for hover/pressed of accent-filled elements). Never on an icon unless it's indicating selection.

For selected rows/tiles where a full-saturation fill is too heavy, use `bg-accent-bg` + `text-accent-text` for a tinted selection state.

The accent is the only "do this / you are here" signal. Other named families cover other meanings, never overlap:
- `info` (blue) — observe/preview/links: Match tab, "Preview migration", external link icons. Teal = "do this", blue = "look at this".
- `ok` — success/ready (daemon ready, scan done). Never for selection.
- `warn` — pending/stale (DROPPED chip, stale index). Text/icon on `warn-bg`, never solid fill.
- `danger` — destructive/unused (`0 refs` chip, delete actions, CANONICAL marker).
- `cluster` — grouping only (CLUSTER chip, cluster-membership indicator). Never a generic accent.
- `citron` — quantity chip only (`×3`, `312 dupes`). Always with `citron-ink`. Chips/badges only — no primary buttons, no full-width fills.

### Typography

- UI: `font-sans` (Inter)
- Paths, hashes, counts, code, kbd hints: `font-mono` (JetBrains Mono)
- Numeric columns: add `tabular-nums` for alignment
- Size scale from `@theme`: `text-xs` 11px, `text-sm` 12px, `text-base` 13px, `text-md` 14px, `text-lg` 16px, `text-xl` 20px. Always use these, never arbitrary brackets.

### Icons (UI chrome)

- Import from `lucide-react` per-icon for tree-shaking: `import { Search, Folder } from "lucide-react"`
- Default size on Lucide icons: `<Search size={14} strokeWidth={1.5} />`
- Lucide is for OUR chrome (toolbar, tree, actions). The indexed user assets are rendered via `/api/preview/:id`, never imported.

## Architecture boundaries (do not cross)

```
UI (app/, components/)
    │ fetch via TanStack Query / SSE
API (app/api/**)
    │ Drizzle queries
Storage (lib/db/)
    │ drizzle-kit migrations
Indexer (lib/indexer/, scripts/pika.ts)
```

- **UI imports from `lib/db/` and `lib/indexer/` are type-only** (`import type`). Runtime data flows exclusively via TanStack Query → `app/api/**`.
- **Only the indexer scans the source tree.** API handlers may `stat` a path to validate it, serve a single asset via `/api/preview/:id`, and write plan artifacts; none of them walk directories.
- **Three writers, each with a defined surface:** the indexer (assets, usages, clusters, fts, `index_runs`), the rename executor (assets/usages rows plus the user's repo via git, behind preflight + the sentinel), and the dispatch system (`dispatch_jobs` rows, plan artifacts, and the user's repo via the agent harness). UI mutates only through those endpoints; everything else is read-only.
- **Cross-process exclusion lives in SQLite.** `index_runs` and `dispatch_jobs` partial unique indexes are the locks; in-process `globalThis` registries hold live handles only. Never add a JS-only guard for something a second process can race.
- **Every UI-facing query must hit an index.** Drizzle gives you type-safe query builders; if the compiled SQL has an unindexed scan on a >1k-row table, it's a bug.
- **Any list > 200 rows is virtualized** with `@tanstack/react-virtual`.

## Data layer (Drizzle)

- Schema lives at `lib/db/schema.ts`. One `pgTable`-style definition per table. Relationships defined via `relations()` for type-inferred joins.
- Migrations generated with `pnpm db:generate`, applied with `pnpm db:migrate`.
- Queries live in `lib/db/queries/{domain}.ts`. One exported function per use case. Never compose queries inline inside route handlers.
- Connection singleton at `lib/db/client.ts`: `drizzle(new Database(dbPath), { schema })` + `PRAGMA journal_mode = WAL`.
- Prefer Drizzle's query API (`db.query.assets.findMany({...})`) over raw SQL. Drop to raw `sql\`...\`` only for FTS5 (not supported natively by Drizzle) and for `PRAGMA`.
- Transactions: `db.transaction((tx) => { ... })`. Always wrap bulk writes.

## Data fetching (TanStack Query)

- `QueryClientProvider` at `app/providers.tsx`. One client per app.
- Query keys are tuples, hierarchical, typed via a key factory in `lib/queries/keys.ts`:
  ```ts
  export const qk = {
    sources: ["sources"] as const,
    tree: (sourceId: number) => ["tree", sourceId] as const,
    folder: (path: string) => ["folder", path] as const,
    asset: (id: number) => ["asset", id] as const,
    usages: (id: number) => ["asset", id, "usages"] as const,
    groups: (kind: string) => ["groups", kind] as const,
    duplicates: (mode: string) => ["duplicates", mode] as const,
  };
  ```
- One `use*()` hook per query, colocated with the component that first consumes it, then promoted to `lib/queries/` if reused.
- Mutations (plans CRUD, dispatch) use `useMutation` with explicit `onSuccess` invalidation of the relevant keys.
- Never call `fetch` directly in components. Always through a `useQuery`/`useMutation` wrapper.
- `staleTime` defaults to `Infinity` for index data (it only changes when the indexer runs); `/api/status` is SSE, not polled.

## UI state (zustand)

Client-only state (selected view, drawer open, bounding-boxes toggle, filters, search string) lives in `useExplorerStore` (`lib/store.ts`). Persist via zustand's `persist` middleware to `localStorage` under key `pika:ui`. Exclude transient state (current hover, active keystroke) from persistence.

## "Add source" UX

Three entry points, all supported:
1. **Drag a folder onto the EmptyState** (webkitdirectory input via a hidden `<input type="file" webkitdirectory>`)
2. **Paste an absolute path** into a text input, validated server-side
3. **CLI**: `pika source add <path> [--label <name>]`

All three funnel into `POST /api/sources` which resolves + validates + kicks off an index.

## Directory layout

```
app/
  layout.tsx        Root HTML + drag-drop capture
  providers.tsx     "use client" — QueryClientProvider, DragDropContext
  globals.css       Tailwind @import + @theme tokens
  page.tsx          Main shell (no URL nav; state in zustand)
  api/**            Route handlers, zod-validated
components/
  Shell.tsx, Toolbar.tsx, StatusBar.tsx, CommandPalette.tsx
  tree/ grid/ grouped/ duplicates/ detail/ match/ plan/ empty/ indexing/ primitives/
lib/
  design/tokens.ts  TS mirror of CSS @theme values, for programmatic access
  config/           zod schema + jiti loader
  db/
    schema.ts       Drizzle table definitions
    client.ts       Singleton + WAL
    queries/        Per-domain query functions
    migrations/     Generated by drizzle-kit
  indexer/          scan, hash, phash, meta, svg, color, usage, cluster-*, styles
  match/            signature, heuristics, normalize
  plan/             schema, parse-prompt, validate, export, dispatch/ (future)
  queries/          TanStack query key factory + shared hooks
  store.ts          zustand store
scripts/pika.ts     CLI entry (commander) — binary name `pika`
drizzle.config.ts
biome.json
data/               sqlite + uploads (gitignored)
pika.config.ts
```

## Commands

- `pnpm dev` — Next dev (Turbopack)
- `pnpm build && pnpm start`
- `pnpm index` — `tsx scripts/pika.ts index`
- `pnpm index:full` — drop caches, re-scan everything
- `pnpm pika <cmd>` — general CLI (`pika status`, `pika source add <path>`, `pika match <file>`)
- `pnpm db:generate` — drizzle-kit generate (new migration from schema diff)
- `pnpm db:migrate` — drizzle-kit migrate (apply pending migrations)
- `pnpm db:studio` — drizzle-kit studio (web UI for inspecting DB)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — `biome check .`
- `pnpm fmt` — `biome format --write .`

## Coding rules (in addition to `~/.claude/rules/*`)

- No em-dashes (use commas, colons, semicolons, or restructure)
- **Cross-module imports go through the `@/` alias**, not relative `../` walks. `@/*` is mapped to the project root in `tsconfig.json`. Short in-directory imports (`./Sibling`, `../parent`) are fine — but any path climbing out of the current feature (e.g. from `components/detail/` into `lib/` or `app/`) MUST use `@/lib/...`, `@/components/...`, `@/app/...`. Never write `"../../../lib/..."`.
- No comments unless the WHY is non-obvious. Never explain WHAT the code does.
- Immutable data. No mutation of objects; spread and return new.
- Files < 400 lines. Functions < 50 lines. Prefer many small files.
- No nested ternaries. Use `if/else` or early returns.
- No `console.log` in committed code.
- API responses follow `ApiResponse<T>` from `~/.claude/rules/patterns.md`.
- All user input validated with zod at the API boundary.
- No mocking the DB in tests (when we add tests). Integration tests hit a real `data/test.db` seeded by a fixture.

## When adding a new UI primitive

1. Is there a Radix primitive? Use it (unstyled, then style with Tailwind).
2. Is the design custom enough that a raw `<button>`/`<div>` with Tailwind is clearer? Use that.
3. Do NOT install a new component library to solve one button.

## When adding a new indexer stage

1. Write the pure function in `lib/indexer/<stage>.ts` with a typed input and output.
2. Add the stage to `scripts/pika.ts` as a sequenced step inside a `db.transaction()`.
3. If new columns are needed: add to `lib/db/schema.ts`, then `pnpm db:generate && pnpm db:migrate`.
4. Update `lib/db/queries/*.ts` with any new query that reads the field.
5. Run `pnpm pika index --full` against `~/Tribe/cohort-live-web` to verify end-to-end.

## When adding a new API route

1. Define zod input schema at the top of the route file.
2. Import the query function from `lib/db/queries/*.ts`; never compose Drizzle calls inline.
3. Wrap response in `ApiResponse<T>`: `{ success: true, data: ... }` or `{ success: false, error: ... }`.
4. Add a matching `useQuery` hook in the caller component or `lib/queries/`.

## When adding a new agent harness

The `claude-code` harness landed in Phase 10 slice 2 for both `patch` and `open-pr` modes. Devin and codex-cli adapters are still stubbed. When implementing one:

1. Add a new file under `lib/plan/dispatch/<harness>.ts` exporting a `Harness` that satisfies `lib/plan/dispatch/types.ts`.
2. Register it in `lib/plan/dispatch/registry.ts`.
3. `isReady(mode)` should probe for CLI presence and any auth state (`.env.local` for API tokens, never hardcoded). Return a specific `reason` when not ready so the UI can surface it verbatim.
4. `run(input, signal)` yields `DispatchEvent`s; treat `signal` abort as SIGTERM followed by SIGKILL after a short grace.
5. Streaming route (`app/api/plans/dispatch/[jobId]/stream`) and cancel route (`app/api/plans/dispatch/[jobId]`) don't change — they read from the job registry.
6. Add the harness to `components/plan/DispatchTab.tsx::HARNESSES` — the picker lists only adapters that are actually registered, never "soon" stubs.

## Verification before marking any phase done

Against the phase's acceptance criteria in the PRD:
1. `pnpm typecheck && pnpm test` clean; `pnpm lint` clean on changed files (docs/ has pre-existing failures)
2. `pnpm dev` renders; manually walk the phase's screens
3. For DB phases: `pnpm db:studio` and verify counts/indexes, or `sqlite3 data/pika.db`
4. For indexer phases: `pnpm pika index --full` against `~/Tribe/cohort-live-web`
5. Pixel check: chrome heights match tokens; accent only on selection/primary/focus

## Never do

- Start a dev server unprompted (from `~/.claude/rules/workflow-guardrails.md`)
- Install a component library other than Radix Primitives + cmdk + lucide-react
- Add CSS-in-JS runtime libraries
- Add ESLint or Prettier (we use Biome)
- Write `style={{}}` inline except in test/sandbox files
- Bypass the API layer from UI code
- Bypass Drizzle by hand-writing SQL strings (except for FTS5 / `PRAGMA`)
- Compute similarity/clusters at request time — always precomputed
- Add a `tailwind.config.js` — v4 config lives in CSS via `@theme`
- Use em-dashes
