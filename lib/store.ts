import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Plan, PlanAction } from "./plan/schema";

export type View = "overview" | "grid" | "clusters" | "match";
export type SizeBucket = "s" | "m" | "l";
export const EXT_FILTERS = ["svg", "png", "jpg", "webp", "gif"] as const;
export type ExtFilter = (typeof EXT_FILTERS)[number];

export type GridSort =
  | "name-asc"
  | "name-desc"
  | "size-asc"
  | "size-desc"
  | "mtime-desc"
  | "mtime-asc";
export const GRID_SORT_LABELS: Record<GridSort, string> = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "size-asc": "Size small → large",
  "size-desc": "Size large → small",
  "mtime-desc": "Modified newest",
  "mtime-asc": "Modified oldest",
};
export const GRID_SORT_SHORT: Record<GridSort, string> = {
  "name-asc": "Name ↑",
  "name-desc": "Name ↓",
  "size-asc": "Size ↑",
  "size-desc": "Size ↓",
  "mtime-desc": "Modified ↓",
  "mtime-asc": "Modified ↑",
};

export type AssetHistoryEntry = { id: number; name: string };

export type ExplorerState = {
  selectedSourceId: number | null;
  selectedFolder: string | null;
  selectedAssetId: number | null;
  assetHistory: AssetHistoryEntry[];
  view: View;
  viewManuallySet: boolean;
  drawerOpen: boolean;
  boundingBoxes: boolean;
  unusedOnly: boolean;
  styleClass: string | null;
  search: string;
  extFilter: ExtFilter[];
  sizeBucket: SizeBucket | null;

  cartIds: readonly number[];
  cartAnchor: number | null;

  setSelectedSource: (id: number | null) => void;
  setSelectedFolder: (path: string | null) => void;
  openAsset: (id: number, prevName?: string) => void;
  goBackAsset: () => void;
  closeDrawer: () => void;
  setView: (view: View, opts?: { manual?: boolean }) => void;
  setDrawerOpen: (open: boolean) => void;
  setBoundingBoxes: (on: boolean) => void;
  setUnusedOnly: (on: boolean) => void;
  setStyleClass: (c: string | null) => void;
  setSearch: (q: string) => void;
  toggleExtFilter: (ext: ExtFilter) => void;
  setSizeBucket: (b: SizeBucket | null) => void;
  clearFilters: () => void;
  gridSort: GridSort;
  setGridSort: (s: GridSort) => void;

  toggleCartItem: (id: number) => void;
  setCartRange: (toId: number, orderedIds: readonly number[]) => void;
  addToCart: (ids: readonly number[]) => void;
  removeFromCart: (ids: readonly number[]) => void;
  clearCart: () => void;

  draftPlan: Plan | null;
  ensureDraftPlan: (sourceId: number, sourceLabel: string) => Plan;
  addPlanAction: (action: PlanAction, sourceId: number, sourceLabel: string) => void;
  removePlanAction: (actionId: string) => void;
  renamePlan: (name: string) => void;
  clearPlan: () => void;

  planDrawerOpen: boolean;
  setPlanDrawerOpen: (open: boolean) => void;
  togglePlanDrawer: () => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  searchFocusNonce: number;
  focusSearch: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      selectedSourceId: null,
      selectedFolder: null,
      selectedAssetId: null,
      assetHistory: [],
      view: "overview",
      viewManuallySet: false,
      drawerOpen: false,
      boundingBoxes: false,
      unusedOnly: false,
      styleClass: null,
      search: "",
      extFilter: [],
      sizeBucket: null,

      cartIds: [],
      cartAnchor: null,

      setSelectedSource: (id) => set({ selectedSourceId: id }),
      setSelectedFolder: (path) => set({ selectedFolder: path }),
      openAsset: (id, prevName) =>
        set((s) => {
          if (s.selectedAssetId === id) return { selectedAssetId: id, drawerOpen: true };
          if (prevName === undefined) {
            return { selectedAssetId: id, drawerOpen: true, assetHistory: [] };
          }
          const existingIdx = s.assetHistory.findIndex((e) => e.id === id);
          if (existingIdx !== -1) {
            return {
              selectedAssetId: id,
              drawerOpen: true,
              assetHistory: s.assetHistory.slice(0, existingIdx),
            };
          }
          const history =
            s.selectedAssetId !== null
              ? [...s.assetHistory, { id: s.selectedAssetId, name: prevName }]
              : s.assetHistory;
          const trimmed = history.length > 10 ? history.slice(history.length - 10) : history;
          return { selectedAssetId: id, drawerOpen: true, assetHistory: trimmed };
        }),
      goBackAsset: () =>
        set((s) => {
          const last = s.assetHistory[s.assetHistory.length - 1];
          if (!last) return s;
          return {
            selectedAssetId: last.id,
            drawerOpen: true,
            assetHistory: s.assetHistory.slice(0, -1),
          };
        }),
      closeDrawer: () => set({ drawerOpen: false, selectedAssetId: null, assetHistory: [] }),
      setView: (view, opts) => set({ view, viewManuallySet: opts?.manual ?? true }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      setBoundingBoxes: (boundingBoxes) => set({ boundingBoxes }),
      setUnusedOnly: (unusedOnly) => set({ unusedOnly }),
      setStyleClass: (styleClass) => set({ styleClass }),
      setSearch: (search) => set({ search }),
      toggleExtFilter: (ext) =>
        set((s) => ({
          extFilter: s.extFilter.includes(ext)
            ? s.extFilter.filter((e) => e !== ext)
            : [...s.extFilter, ext],
        })),
      setSizeBucket: (sizeBucket) => set({ sizeBucket }),
      clearFilters: () => set({ search: "", extFilter: [], sizeBucket: null, unusedOnly: false }),
      gridSort: "name-asc" as GridSort,
      setGridSort: (gridSort) => set({ gridSort }),

      toggleCartItem: (id) =>
        set((s) => {
          const has = s.cartIds.includes(id);
          const nextIds = has ? s.cartIds.filter((n) => n !== id) : [...s.cartIds, id];
          return { cartIds: nextIds, cartAnchor: has ? s.cartAnchor : id };
        }),
      setCartRange: (toId, orderedIds) =>
        set((s) => {
          const anchor = s.cartAnchor ?? toId;
          const aIdx = orderedIds.indexOf(anchor);
          const bIdx = orderedIds.indexOf(toId);
          if (aIdx === -1 || bIdx === -1) {
            const has = s.cartIds.includes(toId);
            return {
              cartIds: has ? s.cartIds : [...s.cartIds, toId],
              cartAnchor: toId,
            };
          }
          const lo = Math.min(aIdx, bIdx);
          const hi = Math.max(aIdx, bIdx);
          const range = orderedIds.slice(lo, hi + 1);
          const merged = new Set<number>(s.cartIds);
          for (const id of range) merged.add(id);
          return { cartIds: Array.from(merged), cartAnchor: toId };
        }),
      addToCart: (ids) =>
        set((s) => {
          const merged = new Set<number>(s.cartIds);
          for (const id of ids) merged.add(id);
          return { cartIds: Array.from(merged) };
        }),
      removeFromCart: (ids) =>
        set((s) => {
          const drop = new Set<number>(ids);
          return { cartIds: s.cartIds.filter((n) => !drop.has(n)) };
        }),
      clearCart: () => set({ cartIds: [], cartAnchor: null }),

      draftPlan: null,
      ensureDraftPlan: (sourceId: number, sourceLabel: string): Plan => {
        const existing = get().draftPlan;
        if (existing && existing.sourceId === sourceId) return existing;
        const now = Date.now();
        const next: Plan = {
          version: "pika/plan v1",
          id: `plan-${now.toString(36)}`,
          name: `Cleanup for ${sourceLabel}`,
          sourceId,
          sourceLabel,
          createdAt: now,
          updatedAt: now,
          actions: [],
        };
        set({ draftPlan: next });
        return next;
      },
      addPlanAction: (action: PlanAction, sourceId: number, sourceLabel: string) => {
        const now = Date.now();
        const cur = get().draftPlan;
        const base: Plan =
          cur && cur.sourceId === sourceId
            ? cur
            : {
                version: "pika/plan v1",
                id: `plan-${now.toString(36)}`,
                name: `Cleanup for ${sourceLabel}`,
                sourceId,
                sourceLabel,
                createdAt: now,
                updatedAt: now,
                actions: [],
              };
        const exists = base.actions.some((a) => a.id === action.id);
        set({
          draftPlan: {
            ...base,
            updatedAt: now,
            actions: exists ? base.actions : [...base.actions, action],
          },
        });
      },
      removePlanAction: (actionId: string) =>
        set((s) => {
          if (!s.draftPlan) return s;
          return {
            draftPlan: {
              ...s.draftPlan,
              updatedAt: Date.now(),
              actions: s.draftPlan.actions.filter((a) => a.id !== actionId),
            },
          };
        }),
      renamePlan: (name: string) =>
        set((s) => {
          if (!s.draftPlan) return s;
          return { draftPlan: { ...s.draftPlan, name, updatedAt: Date.now() } };
        }),
      clearPlan: () => set({ draftPlan: null }),

      planDrawerOpen: false,
      setPlanDrawerOpen: (planDrawerOpen) => set({ planDrawerOpen }),
      togglePlanDrawer: () => set((s) => ({ planDrawerOpen: !s.planDrawerOpen })),

      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
      searchFocusNonce: 0,
      focusSearch: () => set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "pika:ui",
      version: 1,
      migrate: (persistedState, version) => {
        if (version < 1 && persistedState && typeof persistedState === "object") {
          const s = persistedState as Record<string, unknown>;
          delete s.drawerOpen;
          delete s.selectedAssetId;
        }
        if (persistedState && typeof persistedState === "object") {
          const s = persistedState as Record<string, unknown>;
          if (s.view === "grouped" || s.view === "duplicates") s.view = "clusters";
          if (s.view === "plan") s.view = "overview";
        }
        return persistedState as ExplorerState;
      },
      partialize: (state) => ({
        selectedSourceId: state.selectedSourceId,
        selectedFolder: state.selectedFolder,
        view: state.view,
        boundingBoxes: state.boundingBoxes,
        unusedOnly: state.unusedOnly,
        styleClass: state.styleClass,
        extFilter: state.extFilter,
        sizeBucket: state.sizeBucket,
        gridSort: state.gridSort,
        draftPlan: state.draftPlan,
        sidebarCollapsed: state.sidebarCollapsed,
        cartIds: state.cartIds,
      }),
    },
  ),
);
