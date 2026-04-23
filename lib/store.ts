import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Plan, PlanAction } from "./plan/schema";

export type View = "grid" | "grouped" | "duplicates" | "match" | "plan";
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
  drawerOpen: boolean;
  boundingBoxes: boolean;
  unusedOnly: boolean;
  styleClass: string | null;
  search: string;
  extFilter: ExtFilter[];
  sizeBucket: SizeBucket | null;

  setSelectedSource: (id: number | null) => void;
  setSelectedFolder: (path: string | null) => void;
  openAsset: (id: number, prevName?: string) => void;
  goBackAsset: () => void;
  closeDrawer: () => void;
  setView: (view: View) => void;
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

  draftPlan: Plan | null;
  ensureDraftPlan: (sourceId: number, sourceLabel: string) => Plan;
  addPlanAction: (action: PlanAction, sourceId: number, sourceLabel: string) => void;
  removePlanAction: (actionId: string) => void;
  renamePlan: (name: string) => void;
  clearPlan: () => void;

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
      view: "grid",
      drawerOpen: false,
      boundingBoxes: false,
      unusedOnly: false,
      styleClass: null,
      search: "",
      extFilter: [],
      sizeBucket: null,

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
      setView: (view) => set({ view }),
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

      draftPlan: null,
      ensureDraftPlan: (sourceId: number, sourceLabel: string): Plan => {
        const existing = get().draftPlan;
        if (existing && existing.sourceId === sourceId) return existing;
        const now = Date.now();
        const next: Plan = {
          version: "pixeldex/plan v1",
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
                version: "pixeldex/plan v1",
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

      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
      searchFocusNonce: 0,
      focusSearch: () => set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "pixeldex:ui",
      version: 1,
      migrate: (persistedState, version) => {
        if (version < 1 && persistedState && typeof persistedState === "object") {
          const s = persistedState as Record<string, unknown>;
          delete s.drawerOpen;
          delete s.selectedAssetId;
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
      }),
    },
  ),
);
