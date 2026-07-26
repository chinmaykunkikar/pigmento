import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  blurb: string;
};

export function KindPlaceholder({ icon, title, blurb }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-text-3 shadow-sm">
        {icon}
      </span>
      <h1 className="font-sans text-lg font-semibold text-text">{title}</h1>
      <p className="max-w-100 font-mono text-xs text-text-3">{blurb}</p>
    </div>
  );
}
