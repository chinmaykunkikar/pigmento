import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

// ponytail: single-file JSONL with one .1 rollover; bump to N-file rotation only
// if an agent session ever fills a megabyte of tool calls in practice.
const MAX_LOG_BYTES = 1_000_000;
const LOG_NAME = "agent-tool-calls.jsonl";

export type ToolLogEntry = {
  ts: string;
  tool: string;
  argDigest: string;
  code: string;
  ms: number;
};

// Never log raw arg values or paths (they leak project structure); a stable
// short hash is enough to correlate repeated calls.
export function argDigest(args: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(args ?? null))
    .digest("hex")
    .slice(0, 12);
}

function logPath(dbPath: string): string {
  return join(dirname(dbPath), LOG_NAME);
}

export function appendToolLog(dbPath: string, entry: ToolLogEntry): void {
  const file = logPath(dbPath);
  mkdirSync(dirname(file), { recursive: true });
  const size = statSync(file, { throwIfNoEntry: false })?.size ?? 0;
  if (size >= MAX_LOG_BYTES) renameSync(file, `${file}.1`);
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

export function readToolLogTail(dbPath: string, n = 20): ToolLogEntry[] {
  let raw: string;
  try {
    raw = readFileSync(logPath(dbPath), "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter(Boolean)
    .slice(-n)
    .map((l) => JSON.parse(l) as ToolLogEntry);
}
