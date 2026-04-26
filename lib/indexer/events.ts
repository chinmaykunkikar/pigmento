import { EventEmitter } from "node:events";

export type StageEvent =
  | { type: "run-start"; sourceId: number; label: string }
  | { type: "stage-start"; sourceId: number; stage: string }
  | {
      type: "stage-end";
      sourceId: number;
      stage: string;
      detail: string;
      ms: number;
    }
  | { type: "run-end"; sourceId: number; ms: number };

const GLOBAL_KEY = Symbol.for("pika.indexerEvents");

type GlobalStore = { [k: symbol]: EventEmitter | undefined };

export function indexerEvents(): EventEmitter {
  const g = globalThis as unknown as GlobalStore;
  let instance = g[GLOBAL_KEY];
  if (!instance) {
    instance = new EventEmitter();
    instance.setMaxListeners(100);
    g[GLOBAL_KEY] = instance;
  }
  return instance;
}

export function emitStage(ev: StageEvent): void {
  indexerEvents().emit("event", ev);
}
