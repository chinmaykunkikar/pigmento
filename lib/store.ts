import { create } from "zustand";
import { persist } from "zustand/middleware";

export type View = "grid" | "grouped" | "duplicates";

export type ExplorerState = {
  selectedSourceId: number | null;
  selectedFolder: string | null;
  view: View;
  drawerOpen: boolean;
  boundingBoxes: boolean;
  unusedOnly: boolean;
  styleClass: string | null;
  search: string;

  setSelectedSource: (id: number | null) => void;
  setSelectedFolder: (path: string | null) => void;
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
      view: "grid",
      drawerOpen: false,
      boundingBoxes: false,
      unusedOnly: false,
      styleClass: null,
      search: "",

      setSelectedSource: (id) => set({ selectedSourceId: id }),
      setSelectedFolder: (path) => set({ selectedFolder: path }),
      setView: (view) => set({ view }),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      setBoundingBoxes: (boundingBoxes) => set({ boundingBoxes }),
      setUnusedOnly: (unusedOnly) => set({ unusedOnly }),
      setStyleClass: (styleClass) => set({ styleClass }),
      setSearch: (search) => set({ search }),
    }),
    {
      name: "pixeldex:ui",
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
