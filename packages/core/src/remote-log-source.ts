import { extractCompleteLines } from "./fs-log-source.js";
import { parseLine } from "./log-parser.js";
import type { LogLine, LogSource } from "./types.js";

export interface TailResponse {
  size: number;
  truncated: boolean;
  data: string;
}

export class RemoteLogSource implements LogSource {
  readonly id: string;
  readonly name: string;

  private readonly makeUrl: (offset: number) => string;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly readFrom: "start" | "end";
  private readonly onError: ((err: unknown) => void) | undefined;
  private readonly headers: Record<string, string>;
  private readonly subscribers = new Set<(lines: LogLine[]) => void>();
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private offset: number | null = null;
  private partialBuffer = "";
  private stopped = false;

  constructor(
    makeUrl: (offset: number) => string,
    opts: {
      pollIntervalMs?: number;
      fetchImpl?: typeof fetch;
      readFrom?: "start" | "end";
      onError?: (err: unknown) => void;
      /** Headers extra en cada poll (p. ej. token del CLI local). */
      headers?: Record<string, string>;
    } = {},
  ) {
    this.makeUrl = makeUrl;
    this.pollIntervalMs = opts.pollIntervalMs ?? 300;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.readFrom = opts.readFrom ?? "end";
    this.onError = opts.onError;
    this.headers = opts.headers ?? {};
    const initialUrl = makeUrl(0);
    const host = new URL(initialUrl).host;
    this.id = `remote:${host}`;
    this.name = `remote:${host}`;
  }

  async start(): Promise<void> {
    if (this.intervalId !== undefined) {
      return;
    }

    this.offset = null;
    this.partialBuffer = "";
    this.stopped = false;
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

  subscribe(onLines: (lines: LogLine[]) => void): () => void {
    this.subscribers.add(onLines);
    return () => {
      this.subscribers.delete(onLines);
    };
  }

  private async pollOnce(): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      const response = await this.fetchImpl(this.makeUrl(this.offset ?? 0), {
        headers: this.headers,
      });
      if (this.stopped) {
        return;
      }
      const payload: unknown = await response.json();
      if (this.stopped) {
        return;
      }
      if (!this.isTailResponse(payload)) {
        throw new Error("Invalid tail response");
      }

      if (this.offset === null && this.readFrom === "end") {
        this.offset = payload.size;
        return;
      }

      if (payload.truncated === true || (this.offset !== null && payload.size < this.offset)) {
        this.partialBuffer = "";
        this.offset = payload.size;
      }

      const extracted = extractCompleteLines(this.partialBuffer, payload.data);
      this.partialBuffer = extracted.remainder;
      if (extracted.lines.length > 0) {
        this.emit(extracted.lines.map((line) => parseLine(line, this.name)));
      }
      this.offset = payload.size;
    } catch (error) {
      if (!this.stopped) {
        this.onError?.(error);
      }
      // Ignore transient network and payload failures; polling continues.
    }
  }

  private isTailResponse(value: unknown): value is TailResponse {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    const payload = value as Record<string, unknown>;
    return typeof payload.size === "number"
      && Number.isFinite(payload.size)
      && typeof payload.truncated === "boolean"
      && typeof payload.data === "string";
  }

  private emit(lines: LogLine[]): void {
    for (const subscriber of this.subscribers) {
      subscriber(lines);
    }
  }
}