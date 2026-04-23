import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Plan, PlanAction } from "./plan/schema";

export type View = "grid" | "grouped" | "duplicates" | "plan";
export type SizeBucket = "s" | "m" | "l";
export const EXT_FILTERS = ["svg", "png", "jpg", "webp", "gif"] as const;
export type ExtFilter = (typeof EXT_FILTERS)[number];

export type ExplorerState = {
  selectedSourceId: number | null;
  selectedFolder: string | null;
  selectedAssetId: number | null;
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
  openAsset: (id: number) => void;
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

  draftPlan: Plan | null;
  ensureDraftPlan: (sourceId: number, sourceLabel: string) => Plan;
  addPlanAction: (action: PlanAction, sourceId: number, sourceLabel: string) => void;
  removePlanAction: (actionId: string) => void;
  renamePlan: (name: string) => void;
  clearPlan: () => void;
};

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      selectedSourceId: null,
      selectedFolder: null,
      selectedAssetId: null,
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
      openAsset: (id) => set({ selectedAssetId: id, drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false, selectedAssetId: null }),
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
        draftPlan: state.draftPlan,
      }),
    },
  ),
);
