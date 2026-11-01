import type { LogLine } from "./types.js";

/**
 * Match por string exacto del X-Request-ID en el raw de la línea.
 * Cubre IDs que la regex UUID v4 no captura (formatos no-UUID).
 * requestId vacío no matchea para evitar que "" sea match universal.
 */
function lineMatchesRawId(raw: string, requestId: string): boolean {
  return requestId.length > 0 && raw.includes(requestId);
}

export interface RequestRecord {
  requestId: string;       // el UUID que enviamos como X-Request-ID
  method: string;
  url: string;
  statusCode: number | null;
  startedAt: number;       // epoch ms
  durationMs: number | null;
}

export interface CorrelationResult {
  request: RequestRecord;
  matchingLines: LogLine[];      // líneas cuyo requestIds incluye el ID
  contextBefore: LogLine[];      // N líneas antes del primer match
  contextAfter: LogLine[];       // N líneas después del último match
}

/** Margen sobre fin del request para coincidencias por timestamp de la línea (ms). */
export const PROBABLE_WINDOW_EXTRA_MS = 50;
/** Margen sobre fin del request cuando la línea no tiene timestamp (hora de llegada) (ms). */
export const PROBABLE_ARRIVAL_EXTRA_MS = 400;

/**
 * Correlación probable por tiempo: líneas que NO contienen el id exacto de
 * ningún request conocidas, pero cuyo timestamp cae dentro de la ventana
 * [inicio, fin + 50 ms] de EXACTAMENTE UN request.
 * Si no hay timestamp, usa la hora de llegada con ventana [inicio, fin + 400 ms].
 * Lo seguro siempre gana: una línea con algún id exacto nunca es probable.
 * Si la ventana abierta (duración desconocida, request en vuelo) de dos
 * requests contiene el tiempo, es ambiguo y no se asigna a ninguno.
 */
export function probableRequestForLine(
  line: LogLine,
  requests: ReadonlyArray<RequestRecord>,
  arrivalMs: number,
): string | null {
  for (const request of requests) {
    if (request.requestId.length > 0 && line.raw.includes(request.requestId)) {
      return null;
    }
    if (line.requestIds.includes(request.requestId)) {
      return null;
    }
  }

  const parsedTimestamp =
    line.timestamp !== null ? Date.parse(line.timestamp) : Number.NaN;
  const hasOwnTimestamp = Number.isFinite(parsedTimestamp);

  let probableId: string | null = null;
  for (const request of requests) {
    const extraMs = hasOwnTimestamp ? PROBABLE_WINDOW_EXTRA_MS : PROBABLE_ARRIVAL_EXTRA_MS;
    const endBase =
      request.durationMs === null
        ? Number.POSITIVE_INFINITY
        : request.startedAt + request.durationMs;
    const windowEnd = endBase + extraMs;
    const candidateMs = hasOwnTimestamp ? parsedTimestamp : arrivalMs;
    if (candidateMs >= request.startedAt && candidateMs <= windowEnd) {
      if (probableId !== null) {
        return null; // En la ventana de varios requests: no se asigna a ninguno.
      }
      probableId = request.requestId;
    }
  }
  return probableId;
}

export class Correlator {
  private readonly requests = new Map<string, RequestRecord>();
  private readonly buffer: Array<LogLine | undefined>;
  private bufferStart = 0;
  private bufferSize = 0;

  constructor(private contextLines: number = 3, private bufferLimit: number = 5000) {
    this.contextLines = Math.max(0, contextLines);
    this.bufferLimit = Math.max(0, bufferLimit);
    this.buffer = new Array(this.bufferLimit);
  }

  upsertRequest(req: RequestRecord): void {
    this.requests.set(req.requestId, req);
  }

  ingestLines(lines: LogLine[]): void {
    if (this.bufferLimit === 0) {
      return;
    }

    for (const line of lines) {
      const writeIndex = (this.bufferStart + this.bufferSize) % this.bufferLimit;
      this.buffer[writeIndex] = line;

      if (this.bufferSize < this.bufferLimit) {
        this.bufferSize += 1;
      } else {
        this.bufferStart = (this.bufferStart + 1) % this.bufferLimit;
      }
    }
  }

  correlate(requestId: string): CorrelationResult | null {
    const request = this.requests.get(requestId);
    if (request === undefined) {
      return null;
    }

    const lines = this.currentLines();
    const matchingIndexes = lines.reduce<number[]>((indexes, line, index) => {
      if (line.requestIds.includes(requestId) || lineMatchesRawId(line.raw, requestId)) {
        indexes.push(index);
      }
      return indexes;
    }, []);

    if (matchingIndexes.length === 0) {
      return null;
    }

    const firstMatch = matchingIndexes[0];
    const lastMatch = matchingIndexes[matchingIndexes.length - 1];

    return {
      request,
      matchingLines: matchingIndexes.map((index) => lines[index]),
      contextBefore: lines.slice(Math.max(0, firstMatch - this.contextLines), firstMatch),
      contextAfter: lines.slice(lastMatch + 1, lastMatch + 1 + this.contextLines),
    };
  }

  private currentLines(): LogLine[] {
    return Array.from({ length: this.bufferSize }, (_, index) => {
      const line = this.buffer[(this.bufferStart + index) % this.bufferLimit];
      if (line === undefined) {
        throw new Error("Correlator buffer invariant violated");
      }
      return line;
    });
  }
}
