export type ApiResponse<T> =
  | { success: true; data: T; meta?: { total: number; page?: number; limit?: number } }
  | { success: false; error: string };

export function ok<T>(data: T, meta?: { total: number; page?: number; limit?: number }) {
  return Response.json({ success: true, data, ...(meta ? { meta } : {}) } satisfies ApiResponse<T>);
}

export function fail(error: string, status = 400) {
  return Response.json({ success: false, error } satisfies ApiResponse<never>, { status });
}
