import { cn } from "@/lib/cn";

type PikaMarkProps = {
  size?: number;
  color?: string;
  dotColor?: string;
  blink?: boolean;
  square?: boolean;
  squareBg?: string;
  className?: string;
  title?: string;
};

export function PikaMark({
  size = 24,
  color,
  dotColor,
  blink = false,
  square = false,
  squareBg,
  className,
  title,
}: PikaMarkProps) {
  const stroke = color ?? "currentColor";
  const dot = dotColor ?? "var(--color-accent)";
  const bg = squareBg ?? "var(--color-pika-paper)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("block", className)}
    >
      {title ? <title>{title}</title> : null}
      {square ? <rect x="0" y="0" width="24" height="24" rx="3" fill={bg} /> : null}
      <path
        d="M5 4 L13 12 L5 20"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      <rect
        x="16"
        y="14"
        width="4"
        height="4"
        fill={dot}
        className={blink ? "animate-pika-blink" : undefined}
      />
    </svg>
  );
}
