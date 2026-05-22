"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { useExplorerStore } from "@/lib/store";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export default function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const previewBackdrop = useExplorerStore((s) => s.previewBackdrop);

  useEffect(() => {
    document.documentElement.dataset.previewBackdrop = previewBackdrop;
  }, [previewBackdrop]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
