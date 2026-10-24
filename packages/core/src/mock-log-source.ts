import { parseLine } from "./log-parser.js";
import type { LogLine, LogSource } from "./types.js";

const templates = [
  "2026-08-28T12:00:02.000Z DEBUG cache refresh completed",
  "2026-08-28T12:00:03.000Z WARN slow database query detected",
  "INFO health check passed",
];

const METHODS = ["GET", "POST"];
const PATHS = ["/api/users", "/api/orders", "/api/health"];

export interface MockLogSourceOptions {
  /** Si devuelve IDs no vacíos, el 70% de las líneas los citan (como el simulador OPFS). */
  requestIdProvider?: () => string[];
}

export class MockLogSource implements LogSource {
  readonly id: string;
  readonly name: string;
  private interval: ReturnType<typeof setInterval> | undefined;
  private readonly subscribers = new Set<(lines: LogLine[]) => void>();
  private readonly filePath: string;
  private readonly requestIdProvider: (() => string[]) | undefined;

  constructor(id = "mock-log-source", name = "Mock log source", options: MockLogSourceOptions = {}) {
    this.id = id;
    this.name = name;
    this.filePath = name;
    this.requestIdProvider = options.requestIdProvider;
  }

  private buildLine(): string {
    const providedIds = (() => {
      try {
        return this.requestIdProvider?.() ?? [];
      } catch {
        return [];
      }
    })();

    if (providedIds.length > 0 && Math.random() < 0.7) {
      const chosen = providedIds[Math.floor(Math.random() * providedIds.length)] ?? providedIds[0];
      const method = METHODS[Math.floor(Math.random() * METHODS.length)];
      const path = PATHS[Math.floor(Math.random() * PATHS.length)];
      const template = templates[Math.floor(Math.random() * templates.length)];
      return `${template.slice(0, 24)} INFO ${method} ${path} ${chosen}`;
    }

    const template = templates[Math.floor(Math.random() * templates.length)];
    return template;
  }

  async start(): Promise<void> {
    if (this.interval !== undefined) {
      return;
    }

    this.interval = setInterval(() => {
      const lineCount = Math.floor(Math.random() * 5) + 1;
      const lines = Array.from({ length: lineCount }, () => parseLine(this.buildLine(), this.filePath));
      this.subscribers.forEach((subscriber) => subscriber(lines));
    }, 300);
  }

  async stop(): Promise<void> {
    if (this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  subscribe(onLines: (lines: LogLine[]) => void): () => void {
    this.subscribers.add(onLines);
    return () => {
      this.subscribers.delete(onLines);
    };
  }
}
