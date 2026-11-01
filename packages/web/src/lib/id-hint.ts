/* Condición del aviso "Tus logs no incluyen el ID de cada request":
   fuente con logs reales (Backend local o Archivo .log), 2 o más requests
   enviados y ninguna línea segura para ninguno de ellos. */

import type { LogLine } from "@devtool/core";
import type { SourceId } from "./source-state";

export interface HintRequestLike {
  requestId: string;
}

export function shouldShowIdHint(
  source: SourceId,
  requests: ReadonlyArray<HintRequestLike>,
  buffer: ReadonlyArray<LogLine>,
): boolean {
  if (source !== "remote" && source !== "file") {
    return false;
  }
  if (requests.length < 2) {
    return false;
  }
  const ids = new Set(requests.map((request) => request.requestId));
  for (const id of ids) {
    for (const line of buffer) {
      if (line.requestIds.includes(id) || (id !== "" && line.raw.includes(id))) {
        return false;
      }
    }
  }
  return true;
}
