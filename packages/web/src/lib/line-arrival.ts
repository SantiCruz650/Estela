/* Hora de llegada de cada línea: las líneas sin timestamp parseable usan
   la hora del reloj al momento de ingresar (WeakMap: no mutamos LogLine
   del core, la marca muere con el objeto). */

import type { LogLine } from "@devtool/core";

const arrivals = new WeakMap<LogLine, number>();

/** Marca la hora de llegada de un lote que acaba de entrar al panel. */
export function markArrival(lines: readonly LogLine[]): void {
  const now = Date.now();
  for (const line of lines) {
    if (!arrivals.has(line)) {
      arrivals.set(line, now);
    }
  }
}

export function arrivalOf(line: LogLine): number | null {
  return arrivals.get(line) ?? null;
}

/** hh:mm:ss.mmm desde un epoch ms (o null → "--:--:--.---"). */
export function formatClockMs(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs)) {
    return "--:--:--.---";
  }
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const mmm = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mmm}`;
}
