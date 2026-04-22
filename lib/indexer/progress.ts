export class Progress {
  private t0 = Date.now();
  private stageStart = Date.now();
  private write: (s: string) => void;

  constructor(write: (s: string) => void = (s) => process.stdout.write(`${s}\n`)) {
    this.write = write;
  }

  start(_stage: string): void {
    this.stageStart = Date.now();
  }

  end(stage: string, detail: string): void {
    const ms = Date.now() - this.stageStart;
    this.write(`[${stage.padEnd(15)}] ${detail}  (${fmt(ms)})`);
  }

  done(detail = ""): void {
    const ms = Date.now() - this.t0;
    this.write(`done ${detail} · total ${fmt(ms)}`);
  }
}

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
