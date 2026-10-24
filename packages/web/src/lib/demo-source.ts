import type { LogSource } from "@devtool/core";
import { parseLine } from "@devtool/core";
import type { LogLine } from "@devtool/core";
import { buildAmbientRawLine, buildTrailRawLines, TRAIL_AMBIENT_MESSAGES } from "./demo-trail";

/* Barrido de trails para la fuente Demo: cuando se responde un request,
   el runner emite la señal del trail por el bus compartido. */

export interface DemoTrailEvent {
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

type TrailListener = (event: DemoTrailEvent) => void;

class DemoTrailBus {
  private readonly listeners = new Set<TrailListener>();

  emit(event: DemoTrailEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // un listener defectuoso no debe cortar el resto
      }
    });
  }

  subscribe(listener: TrailListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Bus global: `RequestRunner` → fuente demo → líneas en el panel. */
export const demoTrailBus = new DemoTrailBus();

const AMBIENT_INTERVAL_MS = 900;

/** Fuente demo: líneas ambientales sin id + rastros que llegan por el bus. */
export class DemoLogSource implements LogSource {
  readonly id = "demo-log-source";
  readonly name = "Demo";
  private readonly filePath: string;
  private readonly subscribers = new Set<(lines: LogLine[]) => void>();
  private ambientTimer: number | undefined;
  private unsubscribeTrail: (() => void) | null = null;
  private ambientRotation = 0;

  constructor(filePath = "demo") {
    this.filePath = filePath;
  }

  private push(raw: string): void {
    const line = parseLine(raw, this.filePath);
    this.subscribers.forEach((subscriber) => subscriber([line]));
  }

  async start(): Promise<void> {
    if (this.ambientTimer !== undefined) {
      return;
    }
    // Rastros que llegan cuando se responde un request (del bus).
    this.unsubscribeTrail = demoTrailBus.subscribe((event) => {
      const raws = buildTrailRawLines({
        requestId: event.requestId,
        method: event.method,
        url: event.url,
        status: event.status,
        durationMs: event.durationMs,
        ts: new Date().toISOString(),
      });
      const lines = raws.map((raw) => parseLine(raw, this.filePath));
      this.subscribers.forEach((subscriber) => subscriber(lines));
    });
    // Ruido sin id (healthcheck, gc, pool) en bucle.
    this.ambientTimer = window.setInterval(() => {
      const message = TRAIL_AMBIENT_MESSAGES[this.ambientRotation % TRAIL_AMBIENT_MESSAGES.length] ?? "pool stats";
      this.ambientRotation += 1;
      this.push(buildAmbientRawLine(new Date().toISOString(), message));
    }, AMBIENT_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.unsubscribeTrail?.();
    this.unsubscribeTrail = null;
    if (this.ambientTimer !== undefined) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = undefined;
    }
  }

  subscribe(onLines: (lines: LogLine[]) => void): () => void {
    this.subscribers.add(onLines);
    return () => {
      this.subscribers.delete(onLines);
    };
  }
}
