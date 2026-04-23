import { cn } from "@/lib/cn";

type Props = {
  keys: string[];
  className?: string;
};

export function KbdHint({ keys, className }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((k, i) => (
        <kbd
          // biome-ignore lint/suspicious/noArrayIndexKey: key list is stable per render
          key={`${k}-${i}`}
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-border bg-sunken px-1 font-mono text-3xs font-medium text-text-3"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function formatCombo(combo: string): string[] {
  return combo.split("+").map((p) => {
    if (p === "mod") return "⌘";
    if (p === "shift") return "⇧";
    if (p === "alt") return "⌥";
    if (p === "enter") return "↵";
    if (p === "escape") return "esc";
    if (p.length === 1) return p.toUpperCase();
    return p;
  });
}
