/* Fuente web del modo proceso: polling a GET /api/process?cursor=N,
   parseo con el parser central y entrega de la hora EXACTA del CLI (t)
   para la correlación probable (evita la latencia del polling añadida
   por el navegador). */
import { parseLine } from "./log-parser.js";
import type { LogLine } from "./types.js";
import type { ProcessStreamName } from "./process-lines.js";

export interface ProcessSnapshotEntry {
  readonly t: number;
  readonly text: string;
  readonly stream: ProcessStreamName;
}

export interface ProcessSnapshot {
  readonly cursor: number;
  readonly lines: readonly ProcessSnapshotEntry[];
  readonly exited: null | { code: number | null };
}

export interface ProcessLogBatch {
  readonly lines: readonly LogLine[];
  /** Hora del CLI para cada línea (misma posición): correlación probable. */
  readonly arrivalEpochs: readonly number[];
  /** Primer aviso de salida del hijo (después viene siempre null). */
  readonly exitedNow: null | { code: number | null };
}

export interface ProcessLogSourceOptions {
  pollIntervalMs?: number;
  onError?: (error: unknown) => void;
  onPollSuccess?: () => void;
}

const SOURCE_NAME = "proceso";
const DEFAULT_POLL_MS = 300;

export class ProcessLogSource {
  readonly id = "proceso";
  readonly name = SOURCE_NAME;

  private readonly fetchSnapshot: (cursor: number) => Promise<ProcessSnapshot>;
  private readonly pollIntervalMs: number;
  private readonly onError: ((error: unknown) => void) | undefined;
  private readonly onPollSuccess: (() => void) | undefined;
  private readonly subscribers = new Set<(batch: ProcessLogBatch) => void>();
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private cursor = 0;
  private exitedSeen = false;
  private stopped = false;

  constructor(fetchSnapshot: (cursor: number) => Promise<ProcessSnapshot>, opts: ProcessLogSourceOptions = {}) {
    this.fetchSnapshot = fetchSnapshot;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.onError = opts.onError;
    this.onPollSuccess = opts.onPollSuccess;
  }

  /** Primer poll inmediato:arranque con datos ya disponibles. */
  async start(): Promise<void> {
    if (this.intervalId !== undefined) {
      return;
    }
    this.stopped = false;
    this.cursor = 0;
    this.exitedSeen = false;
    await this.pollOnce();
    if (this.stopped) {
      return;
    }
    this.intervalId = setInterval(() => {
      void this.pollOnce();
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.subscribers.clear();
  }

  subscribe(onBatch: (batch: ProcessLogBatch) => void): () => void {
    this.subscribers.add(onBatch);
    return () => {
      this.subscribers.delete(onBatch);
    };
  }

  private async pollOnce(): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      const snapshot: ProcessSnapshot = await this.fetchSnapshot(this.cursor);
      if (this.stopped) {
        return;
      }
      const lines = snapshot.lines.map((entry) => parseLine(entry.text, SOURCE_NAME));
      const arrivalEpochs = snapshot.lines.map((entry) => entry.t);
      const exitedNow = snapshot.exited !== null && !this.exitedSeen ? snapshot.exited : null;
      if (snapshot.exited !== null) {
        this.exitedSeen = true;
      }
      this.cursor = snapshot.cursor;
      this.onPollSuccess?.();
      if (lines.length > 0 || exitedNow !== null) {
        this.emit({ lines, arrivalEpochs, exitedNow });
      }
    } catch (error) {
      if (!this.stopped) {
        this.onError?.(error);
      }
      // Transitorio (CLI reiniciando a cámara): el polling continúa.
    }
  }

  private emit(batch: ProcessLogBatch): void {
    for (const subscriber of this.subscribers) {
      subscriber(batch);
    }
  }
}
