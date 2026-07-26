"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { type ImagesView, useExplorerStore } from "@/lib/store";

export const KIND_ROUTES = {
  overview: "/",
  images: "/images",
  colors: "/colors",
  typography: "/typography",
} as const;

export type Kind = keyof typeof KIND_ROUTES;

export function kindFromPath(pathname: string): Kind {
  if (pathname.startsWith("/images")) return "images";
  if (pathname.startsWith("/colors")) return "colors";
  if (pathname.startsWith("/typography")) return "typography";
  return "overview";
}

export function useKindNav() {
  const router = useRouter();

  const goToKind = useCallback(
    (kind: Kind) => {
      useExplorerStore.setState({ navManuallySet: true });
      router.push(KIND_ROUTES[kind]);
    },
    [router],
  );

  const goToImagesView = useCallback(
    (view: ImagesView) => {
      useExplorerStore.getState().setImagesView(view);
      router.push(KIND_ROUTES.images);
    },
    [router],
  );

  return { goToKind, goToImagesView };
}
