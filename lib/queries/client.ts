import type { ApiResponse } from "../api/response";

export class ApiError extends Error {
  readonly name = "ApiError";
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly path: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

function ensureJson(res: Response, path: string): void {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const statusText = res.statusText || "error";
    throw new ApiError(res.status, statusText, path, `${res.status} ${statusText}: ${path}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  ensureJson(res, path);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new ApiError(res.status, res.statusText || "error", path, json.error);
  return json.data;
}

export async function apiPost<T, B>(path: string, body: B): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  ensureJson(res, path);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new ApiError(res.status, res.statusText || "error", path, json.error);
  return json.data;
}
