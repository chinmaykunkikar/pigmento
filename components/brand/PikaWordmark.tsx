import { cn } from "@/lib/cn";
import { PikaMark } from "./PikaMark";

type PikaWordmarkProps = {
  size?: number;
  color?: string;
  dotColor?: string;
  blink?: boolean;
  showMark?: boolean;
  className?: string;
};

export function PikaWordmark({
  size = 20,
  color,
  dotColor,
  blink = false,
  showMark = true,
  className,
}: PikaWordmarkProps) {
  return (
    <span
      className={cn("inline-flex items-center font-mono leading-none", className)}
      style={{
        fontSize: size,
        gap: size * 0.22,
        letterSpacing: -size * 0.02,
        fontWeight: 600,
        color,
      }}
    >
      {showMark ? (
        <PikaMark size={Math.round(size * 0.95)} color={color} dotColor={dotColor} blink={blink} />
      ) : null}
      <span>pika</span>
    </span>
  );
}
