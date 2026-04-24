"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/queries/client";
import { Check, Copy, TriangleAlert } from "../icons";
import { Button } from "./Button";

type Props = {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorState({ error, title, onRetry, retryLabel = "Retry", className }: Props) {
  const info = normalizeError(error);
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const body = [title ?? info.heading, info.detail ?? "", info.stack ?? ""]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard permission denied or unavailable
    }
  }, [info, title]);

  return (
    <div
      role="alert"
      className={`rounded-sm border border-danger bg-danger-bg p-3 ${className ?? ""}`.trim()}
    >
      <div className="flex items-start gap-2">
        <TriangleAlert size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <div className="font-sans text-sm font-medium text-danger">{title ?? info.heading}</div>
          {info.detail ? (
            <div className="mt-0.5 font-mono text-xs text-text-3">{info.detail}</div>
          ) : null}
          <div className="mt-2 flex items-center gap-1.5">
            {onRetry ? (
              <Button variant="primary" className="h-7" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
            <Button variant="ghost" className="h-7" onClick={onCopy}>
              {copied ? (
                <>
                  <Check size={12} strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} strokeWidth={1.5} />
                  Copy details
                </>
              )}
            </Button>
          </div>
          {info.stack ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-mono text-xs text-text-3 hover:text-text-2">
                Details
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-xs border border-border bg-surface p-2 font-mono text-2xs text-text-2 leading-relaxed">
                {info.stack}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ErrorInfo = {
  heading: string;
  detail: string | null;
  stack: string | null;
};

function normalizeError(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    return {
      heading: error.message,
      detail: `${error.status} ${error.statusText} · ${error.path}`,
      stack: error.stack ?? null,
    };
  }
  if (error instanceof Error) {
    return {
      heading: error.message || "Something went wrong",
      detail: null,
      stack: error.stack ?? null,
    };
  }
  return {
    heading: typeof error === "string" ? error : "Something went wrong",
    detail: null,
    stack: null,
  };
}
