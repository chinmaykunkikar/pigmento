export function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex h-9 flex-shrink-0 select-none items-center gap-2.5 border-b border-border bg-sunken px-3">
      <div className="flex gap-1.5">
        <span className="h-[11px] w-[11px] rounded-full bg-[#e8695a]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#e8b22a]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#4db85a]" />
      </div>
      <div className="flex-1 text-center text-xs tracking-tight text-text-3">{title}</div>
      <div className="w-[54px]" />
    </div>
  );
}
