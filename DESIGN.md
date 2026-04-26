# Pika — Design System

The product spec. Tokens, patterns, principles. Implementation contract lives in `app/globals.css @theme` and `components/primitives/*`. If a decision isn't here, it isn't a decision.

Engineering-scoped rules (imports, file size, commands) live in `CLAUDE.md`. This file is *design only*.

---

## 1. Voice

Tool-grade. Warm-neutral. Single accent. The interface whispers; the data and the relationships between files are the content.

Target user: design-system engineers cleaning up an icon library, frontend leads auditing asset bloat in a monorepo, solo developers asking "is there already an icon for this?" before adding another. They sit in front of this screen for extended stretches during cleanup work.

Emotional goal across a long session: **clear, focused, satisfying**. The user can see progress. Every action has a definite outcome. Nothing surprises them.

What pika is **not**:
- Not SaaS marketing. No hero type, no gradient CTAs, no feature grids.
- Not Figma-chrome. No dark default, no floating purple accents.
- Not Storybook-doc. No centred prose.
- Not consumer-friendly. No pastel, no emoji, no illustrations.

---

## 2. Principles

1. **Tokens first, brackets last.** If a value isn't in `@theme`, add it to `@theme` before using it.
2. **Chrome whispers, data speaks.** Fixed heights, hairline borders, mono for structure, sans for narrative.
3. **The accent rule is inviolable.** `--color-accent` appears only on selection, single primary action, and focus.
4. **Precomputed, never lazy.** No spinners past initial load. Views read indexed DB shape.
5. **Information density beats prettiness.** Tighter rows, mono-aligned numerics, hairline dividers. Users spend hours here.

---

## 3. Tokens (authoritative: `app/globals.css`)

### Color

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#f4f2ec` | Page background (warm paper) |
| `--color-surface` | `#fbfaf6` | Primary content surfaces (toolbar, cards, drawers) |
| `--color-sunken` | `#ecebe6` | Recessed surfaces (search input, filter trays) |
| `--color-sunken-2` | `#e3e1db` | Deeper recess (pressed state) |
| `--color-hover` | `#ecebe6` | Row/button hover |
| `--color-text` | `#15171a` | Primary text |
| `--color-text-2` | `#4a4d52` | Secondary text |
| `--color-text-3` | `#8a8d92` | Meta, mono text, captions |
| `--color-text-4` | `#b3b0a9` | Tertiary / disabled |
| `--color-border` | `#e3e1db` | Hairline dividers |
| `--color-border-2` | `#cfcdc6` | Emphasized hairline (selected row, input focus) |
| `--color-divider` | `#ecebe6` | In-surface dividers (inside a card) |
| `--color-accent` | `#b8492a` | Selection, primary action, focus, mark dot (rust) |
| `--color-accent-bg` | `#f7e8df` | Accent surface (selected row bg) |
| `--color-accent-text` | `#8a3520` | Accent text (on accent-bg) |
| `--color-warn` | `#b48a00` | Warnings, non-blocking issues |
| `--color-warn-bg` | `#fbf5e6` | Warning surface |
| `--color-danger` | `#b03a2e` | Errors, destructive |
| `--color-danger-bg` | `#fbeeea` | Danger surface |
| `--color-ok` | `#3a8e5a` | Success, completion |
| `--color-ok-bg` | `#ecf5ee` | Success surface |
| `--color-checker-a/-b` | `#ffffff` / `#f0eeea` | Asset-preview checker pattern |
| `--color-overlay` | `rgba(20,20,30,0.2)` | Dialog/drawer scrim |

Contrast floor: WCAG AA (4.5:1 text, 3:1 UI). Every new color-on-color pair must be verified before shipping.

### Type

Inter for UI. JetBrains Mono for paths, hashes, counts, kbd, and anything structural.

| Token | Size | LH | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `text-3xs` | 9px | 12 | 500 | — | Tiny labels (badges) |
| `text-2xs` | 10px | 13 | 500 | — | Meta (kbd caption) |
| `text-xs` | 11px | 14 | 450 | — | Captions, table-meta, mono paths |
| `text-sm` | 12px | 16 | 450 | — | UI default |
| `text-base` | 13px | 18 | 450 | -0.05px | Body default |
| `text-md` | 14px | 20 | 500 | -0.1px | Emphasized body, section labels |
| `text-lg` | 16px | 22 | 550 | -0.2px | Subheaders |
| `text-xl` | 20px | 26 | 600 | -0.3px | Page titles |

Numeric columns always use `tabular-nums`.

### Radius

| Token | px | Use |
|---|---|---|
| `rounded-xs` | 2px | Pips, histogram bars, badges |
| `rounded-sm` | 3px | Default controls, cards |
| `rounded-md` | 4px | Floating pills (ActionBar) |
| `rounded-lg` | 6px | Large overlays |

### Shadows (utilities: `shadow-drawer`, `shadow-floating`, `shadow-tile-selected`, `shadow-variant-selected`)

Only functional shadows. No decorative drop-shadows anywhere.

**Exception — drawer + floating shadows MUST stay inline `style={{ boxShadow: "var(--shadow-drawer)" }}`.** `DetailDrawer`, `PlanDrawer`, and `ActionBar` each need inline shadow because it forces the element into its own compositing layer. Without that layer promotion, Chrome breaks the CSS `translate` property on sibling absolute-positioned elements during transitions — the second drawer's `translate-x-full` silently fails to apply and it renders visibly on screen. The other shadow utilities (`shadow-tile-selected`, `shadow-variant-selected`) are fine as classNames because those elements aren't siblings competing for the same compositing layer.

### Motion

Easing: `--ease-out-quart` (general), `--ease-out-quint` (drawers), `--ease-out-expo` (overlay entry).

Durations by role:
- Hover/press: 120–160ms, `ease-out-quart`
- Entrance (overlay, drawer): 180–220ms, `ease-out-expo` / `ease-out-quint`
- Exit: shorter than entrance (160ms typical)
- Success flash: 220ms, `flash-highlight` keyframe

Respect `prefers-reduced-motion` (already wired in `globals.css`). Durations drop to 0.01ms.

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

`--color-accent` (`#b8492a`, rust) appears ONLY on:
1. Currently selected items (tile outline, tree row left bar, tab underline, segmented-control active, radio dot)
2. The single primary action on any given screen
3. Focus rings (`focus-visible:ring-1 ring-accent/40`)

Never as decoration. Never as a hover color. Never on an icon unless the icon signals selection. One accent per view, at most.

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

| Surface | File | Purpose |
|---|---|---|
| Shell | `components/Shell.tsx` | 3-region layout: Sidebar / Main / StatusBar |
| Toolbar | `components/Toolbar.tsx` | Search, filters, view switcher, Plan, Re-index |
| Sidebar | `components/Sidebar.tsx` | Source switcher + folder tree |
| StatusBar | `components/StatusBar.tsx` | Count + bytes + path |
| Overview | `components/overview/PostIndexOverview.tsx` | Next-action list after indexing |
| Grid | `components/grid/AssetGrid.tsx` | Virtualized asset tiles |
| Clusters | `components/clusters/ClustersView.tsx` | Grouped variants + near-dup browser |
| Match | `components/match/MatchView.tsx` | Drag/drop lookup by signature |
| Duplicates | `components/duplicates/DupTab.tsx` | Exact + near-pair tables |
| Indexing | `components/indexing/IndexingCenter.tsx` | Live pipeline status |
| DetailDrawer | `components/detail/DetailDrawer.tsx` | Selected-asset metadata + references |
| PlanDrawer | `components/plan/PlanDrawer.tsx` | Cleanup plan → prompt → dispatch |
| ActionBar | `components/actions/ActionBar.tsx` | Floating bottom pill (selection → plan) |
| CommandPalette | `components/CommandPalette.tsx` | `⌘K` keyboard-first nav |
| EmptyState | `components/empty/EmptyState.tsx` | First-run / no sources |

---

## 9. Keyboard surface (discoverable via `⌘K`)

| Combo | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘F` | Focus search |
| `⌘B` | Toggle sidebar |
| `` ` `` | Jump to Overview |
| `1` | Grid |
| `2` | Clusters |
| `3` | Match |
| `4` | Toggle plan drawer |
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
- Respect `prefers-reduced-motion` (done).

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

> Tokens first. Chrome whispers. Accent is sacred. Precomputed, never lazy. Density beats prettiness.

When a design decision is unclear, consult this file. If the answer isn't here, fix *this file* first, then the code.
