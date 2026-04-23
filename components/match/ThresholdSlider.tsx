"use client";

import * as Slider from "@radix-ui/react-slider";

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
};

export function ThresholdSlider({ value, min, max, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-2xs tracking-wider text-text-3">Δ ≤</span>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => {
          const next = v[0];
          if (typeof next === "number") onChange(next);
        }}
        className="relative flex h-3 w-30 items-center"
        aria-label="pHash threshold"
      >
        <Slider.Track className="relative h-1 flex-1 rounded-xs bg-sunken-2">
          <Slider.Range className="absolute h-full rounded-xs bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-3 w-3 rounded-xs border-[1.5px] border-accent bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
      </Slider.Root>
      <span className="min-w-5 font-mono text-2xs tabular-nums text-text">{value}</span>
    </div>
  );
}
