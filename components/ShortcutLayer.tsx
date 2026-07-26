"use client";

import { useMemo } from "react";
import type { SourceWithMeta } from "@/lib/db/queries/sources";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { useKindNav } from "@/lib/hooks/useKindNav";
import { useExplorerStore } from "@/lib/store";
import { CommandPalette } from "./CommandPalette";

type Props = { source: SourceWithMeta | null };

export function ShortcutLayer({ source }: Props) {
  const togglePalette = useExplorerStore((s) => s.togglePalette);
  const paletteOpen = useExplorerStore((s) => s.paletteOpen);
  const { goToKind } = useKindNav();
  const focusSearch = useExplorerStore((s) => s.focusSearch);
  const drawerOpen = useExplorerStore((s) => s.drawerOpen);
  const closeDrawer = useExplorerStore((s) => s.closeDrawer);
  const toggleSidebar = useExplorerStore((s) => s.toggleSidebar);
  const togglePlanDrawer = useExplorerStore((s) => s.togglePlanDrawer);
  const cyclePreviewBackdrop = useExplorerStore((s) => s.cyclePreviewBackdrop);

  const specs = useMemo(
    () => [
      { combo: "mod+k", handler: togglePalette, allowInInputs: true },
      { combo: "mod+f", handler: focusSearch },
      { combo: "mod+b", handler: toggleSidebar },
      { combo: "`", handler: () => goToKind("overview"), enabled: !!source },
      { combo: "1", handler: () => goToKind("images"), enabled: !!source },
      { combo: "2", handler: () => goToKind("colors"), enabled: !!source },
      { combo: "3", handler: () => goToKind("typography"), enabled: !!source },
      { combo: "4", handler: togglePlanDrawer, enabled: !!source },
      { combo: "b", handler: cyclePreviewBackdrop, enabled: !!source },
      {
        combo: "escape",
        handler: closeDrawer,
        enabled: drawerOpen && !paletteOpen,
      },
    ],
    [
      togglePalette,
      focusSearch,
      toggleSidebar,
      goToKind,
      togglePlanDrawer,
      cyclePreviewBackdrop,
      source,
      drawerOpen,
      paletteOpen,
      closeDrawer,
    ],
  );

  useHotkeys(specs);

  return <CommandPalette source={source} />;
}
