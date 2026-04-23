import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { DispatchEvent, DispatchJobInput, Harness, RunnableMode } from "./types";

const PATCH_TOOLS = ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "LS"];
const PR_TOOLS = [
  ...PATCH_TOOLS,
  "Bash(git:*)",
  "Bash(gh:*)",
  "Bash(pnpm:*)",
  "Bash(npm:*)",
  "Bash(node:*)",
];

export const claudeCodeHarness: Harness = {
  name: "claude-code",

  async isReady(mode) {
    const hasClaude = await which("claude");
    if (!hasClaude) {
      return {
        ready: false,
        reason: "Claude Code CLI not found on PATH. Install it from https://claude.ai/code.",
      };
    }
    if (mode === "open-pr") {
      const hasGh = await which("gh");
      if (!hasGh) {
        return {
          ready: false,
          reason: "GitHub CLI (`gh`) not found on PATH. Required for open-pr mode.",
        };
      }
      const authed = await ghAuthed();
      if (!authed) {
        return { ready: false, reason: "Run `gh auth login` before using open-pr mode." };
      }
    }
    return { ready: true };
  },

  async *run(input, signal) {
    yield* runClaude(input, signal);
  },
};

async function* runClaude(
  input: DispatchJobInput,
  signal: AbortSignal,
): AsyncGenerator<DispatchEvent> {
  const promptPath = join(input.planDir, "plan.md");
  const prompt = await readFile(promptPath, "utf8").catch(() => null);
  if (!prompt) {
    yield errorEvent("failed to read plan prompt file");
    return;
  }

  const args = buildArgs(input.mode);
  const queue = new EventQueue();
  const ts = () => Date.now();

  const child = spawn("claude", args, {
    cwd: input.cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin?.write(prompt);
  child.stdin?.end();

  const stdoutLines = createInterface({ input: child.stdout });
  const stderrLines = createInterface({ input: child.stderr });

  stdoutLines.on("line", (line) => {
    for (const ev of parseStreamLine(line)) queue.push(ev);
  });
  stderrLines.on("line", (line) => {
    queue.push({ type: "stderr", line, ts: ts() });
  });

  child.on("error", (err) => {
    queue.push(errorEvent(`spawn failed: ${err.message}`));
    queue.close();
  });

  child.on("close", async (code, sig) => {
    const exitCode = typeof code === "number" ? code : sig === "SIGTERM" ? 143 : -1;
    let branch: string | undefined;
    let prUrl: string | undefined;
    if (input.mode === "open-pr" && exitCode === 0) {
      queue.push({ type: "info", line: "• probing git branch + PR url", ts: ts() });
      branch = await captureStdout("git", ["rev-parse", "--abbrev-ref", "HEAD"], input.cwd);
      prUrl = await captureStdout("gh", ["pr", "view", "--json", "url", "-q", ".url"], input.cwd);
    }
    queue.push({ type: "done", exitCode, branch, prUrl, ts: ts() });
    queue.close();
  });

  const onAbort = () => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 2000).unref();
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    yield {
      type: "info",
      line: `$ claude ${args.join(" ")} < plan.md (${prompt.length} chars)`,
      ts: ts(),
    };
    for await (const ev of queue) yield ev;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function buildArgs(mode: RunnableMode): string[] {
  const tools = mode === "open-pr" ? PR_TOOLS : PATCH_TOOLS;
  return [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    ...tools,
  ];
}

function parseStreamLine(raw: string): DispatchEvent[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const ts = Date.now();
  let msg: unknown;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return [{ type: "stdout", line: trimmed, ts }];
  }
  if (!msg || typeof msg !== "object") return [{ type: "stdout", line: trimmed, ts }];
  return summarise(msg as Record<string, unknown>, ts);
}

function summarise(msg: Record<string, unknown>, ts: number): DispatchEvent[] {
  const type = typeof msg.type === "string" ? msg.type : "unknown";
  if (type === "system") {
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";
    return [{ type: "info", line: `• system/${subtype || "event"}`, ts }];
  }
  if (type === "assistant") {
    const blocks = extractAssistantBlocks(msg);
    return blocks.map((b) => ({ type: "stdout" as const, line: b, ts }));
  }
  if (type === "user") {
    const blocks = extractUserBlocks(msg);
    return blocks.map((b) => ({ type: "stdout" as const, line: b, ts }));
  }
  if (type === "result") {
    const result = typeof msg.result === "string" ? msg.result.trim() : "";
    const lines: DispatchEvent[] = [];
    if (result) lines.push({ type: "stdout", line: result, ts });
    if (typeof msg.num_turns === "number") {
      lines.push({ type: "info", line: `• result: ${msg.num_turns} turns`, ts });
    }
    return lines;
  }
  return [{ type: "stdout", line: JSON.stringify(msg), ts }];
}

function extractAssistantBlocks(msg: Record<string, unknown>): string[] {
  const message = msg.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) return [];
  const lines: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      const text = b.text.trim();
      if (text) lines.push(text);
    } else if (b.type === "tool_use") {
      lines.push(summariseToolUse(b));
    }
  }
  return lines;
}

function extractUserBlocks(msg: Record<string, unknown>): string[] {
  const message = msg.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) return [];
  const lines: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "tool_result" && typeof b.content === "string") {
      const text = b.content.trim();
      if (text) lines.push(`↳ ${truncate(text, 400)}`);
    }
  }
  return lines;
}

function summariseToolUse(b: Record<string, unknown>): string {
  const name = typeof b.name === "string" ? b.name : "tool";
  const input = (b.input as Record<string, unknown>) ?? {};
  if (name === "Bash" && typeof input.command === "string") {
    return `→ Bash  ${truncate(input.command, 160)}`;
  }
  if (
    (name === "Edit" || name === "Write" || name === "MultiEdit") &&
    typeof input.file_path === "string"
  ) {
    return `→ ${name}  ${input.file_path}`;
  }
  if (name === "Read" && typeof input.file_path === "string") {
    return `→ Read  ${input.file_path}`;
  }
  return `→ ${name}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function errorEvent(message: string): DispatchEvent {
  return { type: "error", message, ts: Date.now() };
}

async function which(bin: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const p = spawn("which", [bin], { stdio: "ignore" });
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

async function ghAuthed(): Promise<boolean> {
  return await new Promise((resolve) => {
    const p = spawn("gh", ["auth", "status"], { stdio: "ignore" });
    p.on("close", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

async function captureStdout(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<string | undefined> {
  return await new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
    let buf = "";
    p.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
    });
    p.on("close", (code) => {
      const trimmed = buf.trim();
      resolve(code === 0 && trimmed ? trimmed : undefined);
    });
    p.on("error", () => resolve(undefined));
  });
}

class EventQueue implements AsyncIterable<DispatchEvent> {
  private queue: DispatchEvent[] = [];
  private resolvers: ((v: IteratorResult<DispatchEvent>) => void)[] = [];
  private closed = false;

  push(ev: DispatchEvent) {
    const r = this.resolvers.shift();
    if (r) r({ value: ev, done: false });
    else this.queue.push(ev);
  }

  close() {
    this.closed = true;
    while (this.resolvers.length) {
      const r = this.resolvers.shift();
      r?.({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<DispatchEvent> {
    return {
      next: (): Promise<IteratorResult<DispatchEvent>> => {
        const ev = this.queue.shift();
        if (ev) return Promise.resolve({ value: ev, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }
}
