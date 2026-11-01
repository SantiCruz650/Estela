/* Conjunto de líneas "probables" de un request: coincidencia por tiempo.
   Puro sobre el estado del correlador, reutilizable por tests. */

import { probableRequestForLine } from "@devtool/core";
import type { LogLine, RequestRecord } from "@devtool/core";
import { arrivalOf } from "./line-arrival";

/** true si la línea menciona el id exacto (seguridad de correlación). */
export function isSecureLineFor(line: LogLine, requestId: string): boolean {
  return line.requestIds.includes(requestId) || (requestId !== "" && line.raw.includes(requestId));
}

/** ids (line.id) de líneas probables de un request, según sus ventanas de tiempo. */
export function probableLineIds(
  buffer: ReadonlyArray<LogLine>,
  requests: ReadonlyArray<RequestRecord>,
  requestId: string,
): Set<string> {
  const set = new Set<string>();
  for (const line of buffer) {
    const arrival = arrivalOf(line);
    if (probableRequestForLine(line, requests, arrival ?? Number.NaN) === requestId) {
      set.add(line.id);
    }
  }
  return set;
}
