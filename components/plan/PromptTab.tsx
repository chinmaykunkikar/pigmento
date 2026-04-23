"use client";

import { useMemo, useState } from "react";
import { generatePrompt } from "@/lib/plan/prompt";
import type { Plan } from "@/lib/plan/schema";
import { Copy } from "../icons";

type Props = { plan: Plan };

export function PromptTab({ plan }: Props) {
  const prompt = useMemo(() => generatePrompt(plan), [plan]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-3">
          Generated from the structured plan. Paste into a coding agent or PR description.
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-sans text-xs font-medium text-text transition-colors hover:bg-hover"
        >
          <Copy size={12} strokeWidth={1.75} />
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>

      <pre className="whitespace-pre-wrap rounded-sm border border-border bg-sunken p-3 font-mono text-xs leading-relaxed text-text">
        {prompt}
      </pre>
    </div>
  );
}
