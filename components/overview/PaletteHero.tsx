import type { BrandColor } from "@/lib/db/queries/colors";

const SLOT_KEYS = ["p0", "p1", "p2", "p3", "p4", "p5", "p6"] as const;

// A fixed row of swatch slots. Ghosted slots are dashed outlines; when the real
// palette arrives the same DOM nodes transition to color, staggered by index, so
// the first-run → live morph resolves in place (never a remount).
export function PaletteHero({ palette }: { palette: BrandColor[] | null }) {
  return (
    <div className="flex h-20 gap-1 overflow-hidden rounded-md">
      {SLOT_KEYS.map((slotKey, i) => {
        const c = palette?.[i] ?? null;
        return (
          <div
            key={slotKey}
            className="relative min-w-0 flex-1 rounded-xs border transition-[background-color,border-color] duration-500 ease-out"
            style={{
              background: c ? c.color : "transparent",
              borderColor: c ? "transparent" : "var(--color-border-2)",
              borderStyle: c ? "solid" : "dashed",
              transitionDelay: `${i * 55}ms`,
            }}
            title={
              c
                ? `${c.color} · ${c.usageCount.toLocaleString()} uses · ${c.distinctFileCount} files`
                : undefined
            }
          >
            {c ? (
              <code className="absolute bottom-1.5 left-1.5 font-mono text-3xs text-white mix-blend-difference">
                {c.color}
              </code>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
