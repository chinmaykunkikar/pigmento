"use client";

import { useEffect } from "react";

export type HotkeySpec = {
  combo: string;
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
  allowInInputs?: boolean;
};

export function useHotkeys(specs: HotkeySpec[]): void {
  useEffect(() => {
    const active = specs.filter((s) => s.enabled !== false);
    if (active.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      const inInput =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      for (const s of active) {
        if (inInput && !s.allowInInputs) continue;
        if (!matches(s.combo, e)) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [specs]);
}

function matches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  if (!key) return false;
  const needMeta = parts.includes("mod");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");

  if (needMeta !== (e.metaKey || e.ctrlKey)) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;

  const pressed = normalizeKey(e.key);
  return pressed === key;
}

function normalizeKey(k: string): string {
  if (k === " ") return "space";
  if (k === "Escape") return "escape";
  if (k === "Enter") return "enter";
  if (k === "ArrowUp") return "up";
  if (k === "ArrowDown") return "down";
  if (k === "ArrowLeft") return "left";
  if (k === "ArrowRight") return "right";
  return k.toLowerCase();
}
