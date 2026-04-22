# PixelDex — project instructions

Local-first developer tool that indexes image/icon assets across a codebase, groups duplicates, shows references, and (eventually) hands a cleanup plan off to a coding agent that opens a PR.

**Full PRD**: `/Users/chinmay/.claude/plans/you-are-building-recursive-gem.md` — read before starting any non-trivial change.

**Dogfood target**: `~/Tribe/cohort-live-web` (Nuxt project, rich asset surface). Point the first real index at this.

## Stack (pinned, verified April 2026)

- **Node 24 LTS**
- **pnpm** (package manager)
- **Next.js 16.2.2** App Router, TypeScript strict
- **React 19**
- **Tailwind CSS v4** (CSS-first config, no JS config file)
- **Radix Primitives** for Dialog, Popover, DropdownMenu, Slider, Tabs, Tooltip
- **`cmdk`** for command palette
- **`lucide-react`** for UI chrome icons (NOT for the indexed assets, which are user-owned)
- **`drizzle-orm`** + **`drizzle-kit`** for SQLite access and migrations
- **`better-sqlite3` 12.6.2** + WAL (driver under Drizzle)
- **`@tanstack/react-query` v5** for all client-side server state
- **`zustand`** for UI-only client state (selection, toggles, open/closed) — not React Context
- **`sharp`** (dims, SVG raster, phash), **`xxhash-wasm`** (content hash)
- **`@tanstack/react-virtual`** (any list > 200 rows)
- **`fuse.js`** + SQLite FTS5 (search)
- **`zod`** (config + API validation)
- **`commander`** (CLI), **`tsx`** (runner), **`jiti`** (TS config loader), **`p-limit`** (bounded concurrency)
- **Biome** (lint + format, single tool)

## Keep docs current — use Context7

Before writing code against any library, framework, or SDK, query Context7 (`resolve-library-id` then `query-docs`) for current docs. Training data lags. Use Context7 for:
- New syntax or API surface (Tailwind v4 changed arbitrary-value syntax; Next.js 16 changed a few conventions; Drizzle's query API evolves)
- Version-specific behavior (`/vercel/next.js/v16.2.2`, `/wiselibs/better-sqlite3/v12.6.2`)
- Anything you'd otherwise Google ("how to X in Y")

Only skip Context7 for pure language features (plain TypeScript, vanilla JS, SQL) or for things you've just confirmed in the same session.

Do NOT add: Base Web, styled-components, emotion, styletron, CSS Modules, Vanilla Extract, ESLint, Prettier, Prisma, raw SQL helpers that bypass Drizzle.

## Install note: sharp on Node 24

If the user has libvips installed globally via Homebrew (`brew install vips`), sharp tries to build from source and fails. Set this before install:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install
```

Document this in README; add a postinstall guard in `package.json` if we see it hit real users.

## Styling rules (Tailwind v4)

### Tokens live in `app/globals.css` via `@theme`

```css
@import "tailwindcss";

@theme {
  /* colors — generate bg-*, text-*, border-* utilities */
  --color-bg:          #fbfbfa;
  --color-surface:     #ffffff;
  --color-sunken:      #f5f4f2;
  --color-sunken-2:    #eceae5;
  --color-hover:       #f0efec;
  --color-text:        #1a1a19;
  --color-text-2:      #54524e;
  --color-text-3:      #8a8782;
  --color-text-4:      #b3b0a9;
  --color-border:      #e8e6e2;
  --color-border-2:    #d8d5cf;
  --color-divider:     #efede9;
  --color-accent:      #3b6cd8;
  --color-accent-bg:   #eef3fe;
  --color-accent-text: #2a53b0;
  --color-warn:        #b48a00;
  --color-warn-bg:     #fbf5e6;
  --color-danger:      #b03a2e;
  --color-danger-bg:   #fbeeea;
  --color-ok:          #3a8e5a;
  --color-ok-bg:       #ecf5ee;

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
| WindowChrome | 36 | `h-9` |
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

`--color-accent` (`#3b6cd8`) appears ONLY on:
1. Currently selected items (tile outline, tree row left bar, tab underline)
2. Primary action buttons (one per screen)
3. Focus rings

Never as decoration. Never as a hover color. Never on an icon unless it's indicating selection.

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
Indexer (lib/indexer/, scripts/ae.ts)
```

- **UI never imports from `lib/db/` or `lib/indexer/`.** Only via TanStack Query → `app/api/**`.
- **API handlers never walk the filesystem.** Only the indexer touches disk.
- **Indexer is the only writer** (plus the plans CRUD endpoints). UI is read-only except plan builder.
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

Client-only state (selected view, drawer open, bounding-boxes toggle, filters, search string) lives in `useExplorerStore` (`lib/store.ts`). Persist via zustand's `persist` middleware to `localStorage` under key `pixeldex:ui`. Exclude transient state (current hover, active keystroke) from persistence.

## "Add source" UX

Three entry points, all supported:
1. **Drag a folder onto the EmptyState** (webkitdirectory input via a hidden `<input type="file" webkitdirectory>`)
2. **Paste an absolute path** into a text input, validated server-side
3. **CLI**: `pdx source add <path> [--label <name>]`

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
  Shell.tsx, Toolbar.tsx, StatusBar.tsx, WindowChrome.tsx, CommandPalette.tsx
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
scripts/pdx.ts      CLI entry (commander) — binary name `pdx`
drizzle.config.ts
biome.json
data/               sqlite + uploads (gitignored)
pixeldex.config.ts
```

## Commands

- `pnpm dev` — Next dev (Turbopack)
- `pnpm build && pnpm start`
- `pnpm index` — `tsx scripts/pdx.ts index`
- `pnpm index:full` — drop caches, re-scan everything
- `pnpm pdx <cmd>` — general CLI (`pdx status`, `pdx source add <path>`, `pdx match <file>`)
- `pnpm db:generate` — drizzle-kit generate (new migration from schema diff)
- `pnpm db:migrate` — drizzle-kit migrate (apply pending migrations)
- `pnpm db:studio` — drizzle-kit studio (web UI for inspecting DB)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — `biome check .`
- `pnpm fmt` — `biome format --write .`

## Coding rules (in addition to `~/.claude/rules/*`)

- No em-dashes (use commas, colons, semicolons, or restructure)
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
2. Add the stage to `scripts/pdx.ts` as a sequenced step inside a `db.transaction()`.
3. If new columns are needed: add to `lib/db/schema.ts`, then `pnpm db:generate && pnpm db:migrate`.
4. Update `lib/db/queries/*.ts` with any new query that reads the field.
5. Run `pnpm pdx index --full` against `~/Tribe/cohort-live-web` to verify end-to-end.

## When adding a new API route

1. Define zod input schema at the top of the route file.
2. Import the query function from `lib/db/queries/*.ts`; never compose Drizzle calls inline.
3. Wrap response in `ApiResponse<T>`: `{ success: true, data: ... }` or `{ success: false, error: ... }`.
4. Add a matching `useQuery` hook in the caller component or `lib/queries/`.

## When adding a new agent harness (deferred)

Agent dispatch is Phase 10+ and most specifics (Devin, codex-cli integrations) are deferred. When that phase lands, implement `lib/plan/dispatch/types.ts::Harness`; never hardcode credentials; read from `.env.local`.

## Verification before marking any phase done

Against the phase's acceptance criteria in the PRD:
1. `pnpm typecheck && pnpm lint` clean
2. `pnpm dev` renders; manually walk the phase's screens
3. For DB phases: `pnpm db:studio` and verify counts/indexes, or `sqlite3 data/pixeldex.db`
4. For indexer phases: `pnpm pdx index --full` against `~/Tribe/cohort-live-web`
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
