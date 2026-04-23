"use client";

import * as RScrollArea from "@radix-ui/react-scroll-area";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  orientation?: "vertical" | "horizontal" | "both";
};

export const ScrollArea = forwardRef<HTMLDivElement, Props>(function ScrollArea(
  { children, className, viewportClassName, orientation = "vertical" },
  ref,
) {
  return (
    <RScrollArea.Root type="hover" className={cn("overflow-hidden", className)}>
      <RScrollArea.Viewport
        ref={ref}
        className={cn("h-full w-full [&>div]:!block", viewportClassName)}
      >
        {children}
      </RScrollArea.Viewport>
      {orientation !== "horizontal" ? <Bar orientation="vertical" /> : null}
      {orientation !== "vertical" ? <Bar orientation="horizontal" /> : null}
      <RScrollArea.Corner className="bg-transparent" />
    </RScrollArea.Root>
  );
});

function Bar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <RScrollArea.Scrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none bg-transparent p-0.5 transition-colors data-[state=visible]:bg-sunken/40",
        orientation === "vertical" ? "h-full w-2" : "h-2 w-full flex-col",
      )}
    >
      <RScrollArea.Thumb className="relative flex-1 rounded-full bg-border-2 transition-colors hover:bg-text-3 before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:h-full before:w-full before:min-h-11 before:min-w-11" />
    </RScrollArea.Scrollbar>
  );
}
