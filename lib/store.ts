import { create } from "zustand";
import { persist } from "zustand/middleware";

export type View = "grid" | "grouped" | "duplicates";

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
};

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set) => ({
      selectedSourceId: null,
      selectedFolder: null,
      selectedAssetId: null,
      view: "grid",
      drawerOpen: false,
      boundingBoxes: false,
      unusedOnly: false,
      styleClass: null,
      search: "",

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
      }),
    },
  ),
);
