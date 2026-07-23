import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { StageEvent } from "@/lib/indexer/events";
import { err } from "./envelope";
import { appendToolLog, argDigest } from "./log";
import { repoRootOf } from "./repo";
import { IndexFailedError, NotIndexedError, type ResolvedRepo, resolveRepoSource } from "./source";
import {
  findSimilarAsset,
  getPalette,
  getTypographyScaleTool,
  listDriftTool,
  resolveTokenForValue,
} from "./tools";

const pkg = createRequire(import.meta.url)("../../package.json") as { version: string };

type ProgressExtra = {
  _meta?: { progressToken?: string | number };
  sendNotification: (n: {
    method: "notifications/progress";
    params: { progressToken: string | number; progress: number; message?: string };
  }) => Promise<void>;
};

function mapError(e: unknown): object {
  if (e instanceof NotIndexedError) return err("not_indexed", e.message, e.remedy);
  if (e instanceof IndexFailedError) {
    return { ...err("index_failed", e.message, e.remedy), stage: e.stage };
  }
  return err(
    "internal",
    e instanceof Error ? e.message : String(e),
    "retry; if it persists, run `pigmento index` manually",
  );
}

function toResult(env: object) {
  const isError = "ok" in env && (env as { ok: unknown }).ok === false;
  return { content: [{ type: "text" as const, text: JSON.stringify(env, null, 2) }], isError };
}

function progressForwarder(extra: ProgressExtra) {
  let n = 0;
  return (ev: StageEvent) => {
    const token = extra._meta?.progressToken;
    if (token === undefined || ev.type !== "stage-end") return;
    n += 1;
    void extra.sendNotification({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress: n,
        message: `indexing: ${ev.stage} (${ev.detail})`,
      },
    });
  };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "pigmento", version: pkg.version });
  const dbPath = `${repoRootOf(process.cwd())}/data/pika.db`;

  async function dispatch(
    name: string,
    args: unknown,
    extra: ProgressExtra,
    fn: (repo: ResolvedRepo) => Promise<object> | object,
  ) {
    const t0 = Date.now();
    let env: object;
    try {
      const repo = await resolveRepoSource({ onProgress: progressForwarder(extra) });
      env = await fn(repo);
    } catch (e) {
      env = mapError(e);
    }
    const code =
      "ok" in env && (env as { ok: unknown }).ok === false
        ? String((env as Record<string, unknown>).code)
        : "ok";
    try {
      appendToolLog(dbPath, {
        ts: new Date().toISOString(),
        tool: name,
        argDigest: argDigest(args),
        code,
        ms: Date.now() - t0,
      });
    } catch {
      // logging is best-effort; never fail a tool call over the audit log
    }
    return toResult(env);
  }

  const FIRST_CALL =
    "First call on an unindexed repo triggers a synchronous full index and may take a while; retry on timeout.";

  server.registerTool(
    "get_palette",
    {
      description: `The repo's brand color palette with per-color usage counts. ${FIRST_CALL}`,
      inputSchema: {},
    },
    (args, extra) => dispatch("get_palette", args, extra, (r) => getPalette(r.db, r.source.id)),
  );

  server.registerTool(
    "resolve_token_for_value",
    {
      description: `Snap a raw CSS color to the nearest existing token/brand color by ΔE2000. ${FIRST_CALL}`,
      inputSchema: { value: z.string().describe("any CSS color, e.g. #1c7a75 or rgb(28,122,116)") },
    },
    (args, extra) =>
      dispatch("resolve_token_for_value", args, extra, (r) =>
        resolveTokenForValue(r.db, r.source.id, args),
      ),
  );

  server.registerTool(
    "find_similar_asset",
    {
      description: `Find indexed assets similar to an image file (by phash/name, plus CLIP when enabled). ${FIRST_CALL}`,
      inputSchema: {
        path: z.string().describe("path to an image file inside the repo or OS temp dir"),
        topN: z.number().int().min(1).max(50).optional().describe("max results (default 10)"),
      },
    },
    (args, extra) =>
      dispatch("find_similar_asset", args, extra, (r) =>
        findSimilarAsset(r.db, r.source, r.config, args),
      ),
  );

  server.registerTool(
    "get_typography_scale",
    {
      description: `The repo's typographic scale: families, sizes, weights, line-heights. ${FIRST_CALL}`,
      inputSchema: {},
    },
    (args, extra) =>
      dispatch("get_typography_scale", args, extra, (r) =>
        getTypographyScaleTool(r.db, r.source.id),
      ),
  );

  server.registerTool(
    "list_drift",
    {
      description: `Suspicion-ranked near-miss color/type clusters with file:line. ${FIRST_CALL}`,
      inputSchema: {
        kind: z.enum(["color", "type"]).optional().describe("limit to one kind (default both)"),
        topN: z.number().int().min(1).max(100).optional().describe("max per kind (default 10)"),
      },
    },
    (args, extra) =>
      dispatch("list_drift", args, extra, (r) => listDriftTool(r.db, r.source.id, args)),
  );

  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}
