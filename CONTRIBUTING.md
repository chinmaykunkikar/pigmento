# Contributing to pika

Pika is a local-first developer tool. Contributions are welcome. This guide covers the workflow; the deeper engineering rules live in [`CLAUDE.md`](./CLAUDE.md) and the design system in [`DESIGN.md`](./DESIGN.md).

## Prerequisites

- **Node 24 LTS**
- **pnpm 10** (`corepack enable` will pick it up from `package.json`)
- macOS, Linux, or Windows
- macOS heads-up: if libvips is installed via Homebrew, prefix the install with `SHARP_IGNORE_GLOBAL_LIBVIPS=1` so sharp uses its bundled prebuilt instead of trying to compile from source.

## Local setup

```sh
git clone https://github.com/chinmaykunkikar/pika.git
cd pika
pnpm install
pnpm db:migrate
pnpm pika source add /path/to/some/repo
pnpm pika index
pnpm dev                              # http://localhost:9900
```

For dogfooding, point a real, asset-rich source at it. Anything Nuxt or Next-shaped works well.

## Project layout

```
app/                Next 16 App Router (UI + API)
  api/**            Route handlers, zod-validated, ApiResponse<T> shape
  globals.css       Tailwind v4 @theme tokens
components/         Client components, organized by feature
  brand/            PikaMark, PikaWordmark
  primitives/       Reusable UI primitives (Button, Chip, Toggle, ...)
lib/
  db/               Drizzle schema, client, queries, migrations
  indexer/          Scan, hash, phash, meta, svg, color, usage, cluster, styles
  match/            Signature, heuristics, normalize, optional CLIP
  plan/             Schema, parse, validate, export, dispatch/
  queries/          TanStack Query key factory + hooks
  store.ts          Zustand UI-only state
scripts/pika.ts     CLI entry (commander)
```

## Style

We use [Biome](https://biomejs.net) for both lint and format; before committing:

```sh
pnpm typecheck
pnpm lint
pnpm fmt
```

Hard rules (also in `~/.claude/rules` if you're using Claude Code on the project):

- **TypeScript strict.** No `any`. No suppressing errors with `@ts-ignore`.
- **Immutability.** Spread and return new objects; never mutate inputs.
- **No em-dashes** (`—`) anywhere. Use commas, colons, semicolons, or restructure. En-dashes are fine for date ranges (`2022–2024`).
- **Many small files.** Prefer 200–400 lines per file; 800 is the hard ceiling.
- **No nested ternaries.** Use `if/else`, early returns, or extract a variable.
- **No comments unless the *why* is non-obvious.** Don't explain *what* the code does.
- **Imports across modules go through the `@/` alias**, not relative `../../`.
- **Validate user input at the API boundary with zod.** Never pass raw input to the DB.
- **Tailwind v4 syntax**: tokens live in CSS via `@theme`. Use `bg-(--color-x)` for CSS-var references and `bg-[#abc]` only for genuinely off-scale literals.

## Architecture boundaries

These exist for a reason; please don't cross them:

- UI never imports from `lib/db/` or `lib/indexer/`. Data flows through `app/api/**` via TanStack Query.
- API handlers never walk the filesystem; only the indexer touches disk.
- The indexer (and the plan CRUD endpoints) are the only writers. The UI is read-only outside the plan builder.
- Every UI-facing query must hit an index. Lists over 200 rows must virtualize via `@tanstack/react-virtual`.
- Don't add CSS-in-JS, ESLint, Prettier, or a second component library. We use Tailwind, Biome, and Radix.

## Commits

Conventional, lowercase, imperative:

```
feat(scope): short description
fix(scope): ...
chore: ...
refactor(ui): ...
```

Examples from history:

```
feat(toolbar): hide ext pills for absent types, gate size filters behind flag
feat(ui): split re-index modality + responsive collapse below 1024px
feat(ui): Overview in view switcher, first-visit hints, post-dispatch reindex
```

The body should explain the *why* if it isn't already obvious from the diff. Avoid `(IMPORTANT)`, `(BUG FIX)`, etc. in messages.

## Adding a new indexer stage

1. Write a pure function in `lib/indexer/<stage>.ts` with typed input and output.
2. Sequence it in `scripts/pika.ts` inside a `db.transaction()`.
3. New columns: edit `lib/db/schema.ts`, then `pnpm db:generate && pnpm db:migrate`.
4. Add any new query in `lib/db/queries/*.ts`.
5. Run `pnpm pika index --full` against a real source to verify end-to-end.

## Adding a new API route

1. Define a zod input schema at the top of the route file.
2. Import a query function from `lib/db/queries/*.ts`; never compose Drizzle calls inline.
3. Wrap the response in `ApiResponse<T>`: `{ success: true, data }` or `{ success: false, error }`.
4. Add a matching `useQuery` / `useMutation` hook in the consuming component or `lib/queries/`.

## Adding a new agent harness

1. Create `lib/plan/dispatch/<harness>.ts` exporting a `Harness` per `lib/plan/dispatch/types.ts`.
2. Register it in `lib/plan/dispatch/registry.ts`.
3. `isReady(mode)` should probe for CLI presence and any required auth state.
4. `run(input, signal)` yields `DispatchEvent`s and treats abort as SIGTERM, then SIGKILL after a short grace window.
5. Flip the `ready` flag in `components/plan/DispatchTab.tsx::HARNESSES`.

## Testing

There is no automated test suite yet. Verification today:

- `pnpm typecheck && pnpm lint`
- `pnpm dev` and dogfood the affected screens
- For DB phases: `pnpm db:studio` and verify counts/indexes
- For indexer phases: `pnpm pika index --full` against a real codebase

If you're adding a feature that warrants tests, integration tests should hit a real `data/test.db` seeded by a fixture, not a mocked DB.

## Reporting issues

Open a GitHub issue with: what you expected, what happened, and the smallest repro you can give us. Logs from `pnpm pika status` or the indexer help. If it's a UI issue, a screenshot is worth more than a paragraph.

## Code of conduct

Be kind. Assume good faith. Disagree on the merits, not the person.
