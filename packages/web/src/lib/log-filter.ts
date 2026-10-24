/* Niveles del filtro del panel de logs y coincidencia por texto/id. */

import type { LogLine } from "@devtool/core";

export type LevelFilter = "all" | "info" | "warn" | "error" | "debug";

export interface LogFilter {
  level: LevelFilter;
  query: string;
}

export interface LevelCounts {
  all: number;
  info: number;
  warn: number;
  error: number;
  debug: number;
}

export const LEVEL_FILTERS: readonly LevelFilter[] = ["all", "info", "warn", "error", "debug"];

const LEVEL_NAMES: Record<LevelFilter, string> = {
  all: "Todos",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  debug: "DEBUG",
};

export function levelFilterName(level: LevelFilter): string {
  return LEVEL_NAMES[level];
}

/** Coincidencia: un solo chip de nivel activo (o "all") + búsqueda en mensaje e id. */
export function matchesFilter(line: LogLine, filter: LogFilter): boolean {
  if (filter.level !== "all" && line.level !== filter.level) {
    return false;
  }
  const query = filter.query.trim().toLowerCase();
  if (query === "") {
    return true;
  }
  return (
    line.raw.toLowerCase().includes(query) ||
    line.requestIds.some((id) => id.toLowerCase().includes(query))
  );
}

/** Lista filtrada conservando el orden del buffer. */
export function filterLines(lines: readonly LogLine[], filter: LogFilter): LogLine[] {
  return lines.filter((line) => matchesFilter(line, filter));
}

/** Conteo por nivel (para los chips: Todos, INFO, WARN, ERROR, DEBUG). */
export function countByLevel(lines: readonly LogLine[]): LevelCounts {
  return lines.reduce<LevelCounts>(
    (counts, line) => {
      if (line.level === "info" || line.level === "warn" || line.level === "error" || line.level === "debug") {
        counts[line.level] += 1;
      }
      counts.all += 1;
      return counts;
    },
    { all: 0, info: 0, warn: 0, error: 0, debug: 0 },
  );
}
