export type AttemptFailure = { label: string; file: string; reason: string };

function reasonOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class FailureLog {
  readonly failures: AttemptFailure[] = [];

  get size(): number {
    return this.failures.length;
  }

  async attempt<T>(label: string, file: string, fn: () => Promise<T> | T): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.failures.push({ label, file, reason: reasonOf(err) });
      return null;
    }
  }

  sample(max = 20): AttemptFailure[] {
    return this.failures.slice(0, max);
  }

  summary(): string {
    if (this.failures.length === 0) return "";
    const byReason = new Map<string, number>();
    for (const f of this.failures) {
      byReason.set(f.reason, (byReason.get(f.reason) ?? 0) + 1);
    }
    const top = [...byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, n]) => (n > 1 ? `${reason} ×${n}` : reason))
      .join("; ");
    return `${this.failures.length} failed (${top})`;
  }
}
