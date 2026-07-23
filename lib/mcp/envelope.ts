export type ErrorCode =
  | "not_indexed"
  | "index_failed"
  | "invalid_input"
  | "unsupported"
  | "internal";

export type Err = { ok: false; code: ErrorCode; message: string; remedy: string };

export type Ok<T extends Record<string, unknown>> = { ok: true } & T;

export function err(code: ErrorCode, message: string, remedy: string): Err {
  return { ok: false, code, message, remedy };
}

export function ok<T extends Record<string, unknown>>(data: T): Ok<T> {
  return { ok: true, ...data };
}

export function isErr(env: { ok: boolean }): env is Err {
  return env.ok === false;
}
