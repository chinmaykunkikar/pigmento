"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { X } from "./icons";

const DISMISS_KEY = "pigmento:narrow-banner-dismissed";

export function NarrowViewportBanner() {
  const isNarrow = useMediaQuery("(max-width: 1023.98px)");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
  }, []);

  if (!isNarrow || dismissed) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex h-7 flex-shrink-0 items-center gap-2 border-b border-warn/30 bg-warn-bg px-4 font-mono text-xs text-warn">
      <span className="flex-1 truncate">
        pigmento is a desktop tool. Some views may be cramped below 1024px.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss narrow viewport banner"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-xs text-warn/70 transition-colors hover:bg-warn/10 hover:text-warn"
      >
        <X size={10} strokeWidth={1.75} />
      </button>
    </div>
  );
}
