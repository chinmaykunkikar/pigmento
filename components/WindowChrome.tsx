export function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex h-9 flex-shrink-0 select-none items-center border-b border-border bg-sunken px-4">
      <div className="flex-1 text-center text-xs tracking-tight text-text-3">{title}</div>
    </div>
  );
}
