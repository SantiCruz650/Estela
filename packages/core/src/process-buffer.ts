/* Buffer circular de la salida del hijo: SOLO memoria (máx. 20 000 líneas
   y máx. 5 MB); el endpoint GET /api/process lee incrementalmente por
   cursor. Puro: sirve al CLI (node) y queda testeable en Vitest. */

import type { ProcessLineEntry, ProcessStreamName } from "./process-lines.js";

export const PROCESS_BUFFER_MAX_LINES = 20_000;
export const PROCESS_BUFFER_MAX_BYTES = 5 * 1024 * 1024;

export interface ProcessLogSnapshot {
  /** Índice del próximo cursor (cliente lo devuelve tal cual). */
  readonly cursor: number;
  readonly lines: readonly ProcessLineEntry[];
  /** El hijo terminó: código normal, o null si lo matamos (Ctrl+C / crash sin código). */
  readonly exited: null | { code: number | null };
}

interface TrackedEntry {
  readonly index: number;
  readonly entry: ProcessLineEntry;
  readonly utf8Length: number;
}

export class ProcessLogBuffer {
  private readonly tracked: TrackedEntry[] = [];
  private nextIndex = 0;
  private bytes = 0;
  /** undefined = aún corre; number/null = terminó. */
  private exitedCode: number | null | undefined;
  private readonly encoder = new TextEncoder();

  /** Registra una línea con su hora exacta de llegada al CLI. */
  append(t: number, text: string, stream: ProcessStreamName): void {
    const utf8Length = this.encoder.encode(text).byteLength;
    const entry: ProcessLineEntry = { t, text, stream };
    this.tracked.push({ index: this.nextIndex, entry, utf8Length });
    this.nextIndex += 1;
    this.bytes += utf8Length;
    while (this.bytes > PROCESS_BUFFER_MAX_BYTES || this.tracked.length > PROCESS_BUFFER_MAX_LINES) {
      const oldest = this.tracked.shift();
      if (oldest === undefined) {
        break;
      }
      this.bytes -= oldest.utf8Length;
    }
  }

  /** El hijo terminó por sí solo con este código (o null si no se obtuvo). */
  setExited(code: number | null): void {
    this.exitedCode = code;
  }

  /** true cuando ya se registró una salida (normal o matado). */
  get hasExited(): boolean {
    return this.exitedCode !== undefined;
  }

  readFrom(cursor: number): ProcessLogSnapshot {
    let start = 0;
    while (start < this.tracked.length && this.tracked[start]?.index < cursor) {
      start += 1;
    }
    return {
      cursor: this.nextIndex,
      lines: this.tracked.slice(start).map((tracked) => tracked.entry),
      exited: this.exitedCode === undefined ? null : { code: this.exitedCode },
    };
  }
}
