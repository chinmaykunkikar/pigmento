"use client";

type Props = { bins: number[]; threshold: number };

export function HammingHistogram({ bins, threshold }: Props) {
  const max = Math.max(1, ...bins);

  return (
    <div className="w-90">
      <div className="mb-1 flex justify-between font-mono text-2xs text-text-3">
        <span>distance</span>
        <span>
          threshold: <span className="text-text tabular-nums">≤ {threshold}</span>
        </span>
      </div>
      <div className="flex h-[22px] items-end gap-0.5">
        {bins.map((v, i) => {
          const h = Math.max(2, (v / max) * 22);
          const active = i <= threshold;
          const opacity = active ? 0.4 + (v / max) * 0.6 : 0.5;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length histogram
              key={i}
              className={`flex-1 rounded-[1px] ${active ? "bg-accent" : "bg-border-2"}`}
              style={{ height: `${h}px`, opacity }}
              title={`Δ${i}: ${v}`}
            />
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-3xs text-text-4">
        <span>0</span>
        <span>identical</span>
        <span>different · 16+</span>
      </div>
    </div>
  );
}
