"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type ExportFormat, planSchemaFooter, serializePlan } from "@/lib/plan/export";
import type { Plan } from "@/lib/plan/schema";
import { Copy, Download } from "../icons";

type Props = { plan: Plan };

const FORMATS: { value: ExportFormat; label: string; ext: string; mime: string }[] = [
  { value: "json", label: "JSON", ext: "json", mime: "application/json" },
  { value: "csv", label: "CSV", ext: "csv", mime: "text/csv" },
  { value: "yaml", label: "YAML", ext: "yaml", mime: "text/yaml" },
];

export function ExportTab({ plan }: Props) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [copied, setCopied] = useState(false);

  const body = useMemo(() => serializePlan(plan, format), [plan, format]);
  const current = FORMATS.find((f) => f.value === format) ?? FORMATS[0];
  if (!current) throw new Error("no export format");

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const download = () => {
    const blob = new Blob([body], { type: current.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.id}.${current.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-sm border border-border">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={cn(
                "h-7 px-3 font-sans text-xs font-medium transition-colors",
                format === f.value
                  ? "bg-accent-bg text-accent-text"
                  : "bg-surface text-text-2 hover:bg-hover",
                f.value !== "json" && "border-border border-l",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-sans text-xs font-medium text-text transition-colors hover:bg-hover"
        >
          <Copy size={12} strokeWidth={1.75} />
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-accent bg-accent px-2.5 font-sans text-xs font-medium text-white transition-colors hover:brightness-110"
        >
          <Download size={12} strokeWidth={1.75} />
          Download
        </button>
      </div>

      <pre className="overflow-auto rounded-sm bg-text p-3 font-mono text-2xs leading-relaxed text-[#e8e6e2]">
        {body}
      </pre>

      <div className="text-right font-mono text-2xs text-text-3">{planSchemaFooter()}</div>
    </div>
  );
}
