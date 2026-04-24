"use client";

type Props = {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
};

export function AssetPreview({ id, name, width, height }: Props) {
  const label = width && height ? `${width} × ${height}` : null;
  return (
    <div className="bg-checker relative flex h-50 items-center justify-center overflow-hidden rounded-sm border border-border [--checker-size:20px]">
      {/** biome-ignore lint/performance/noImgElement: preview stream */}
      <img
        src={`/api/preview/${id}`}
        alt={name}
        draggable={false}
        className="max-h-[80%] max-w-[80%] select-none"
      />
      {label ? (
        <span className="absolute bottom-1.5 right-1.5 rounded-xs bg-surface/85 px-1 font-mono text-3xs text-text-3">
          {label}
        </span>
      ) : null}
    </div>
  );
}
