import Dexie, { type Table } from "dexie";
import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";

export interface HistoryEntry {
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  startedAt: number;
  backendRequestId?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
}

export const MAX_STORED_BODY = 10_000;

/** Headers cuyo valor jamás se persiste en el historial (solo lo que se guarda, no lo que se envía). */
const REDACTED_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
]);

export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (headers === undefined) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = REDACTED_HEADER_NAMES.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return result;
}

export class DevtoolDB extends Dexie {
  history!: Table<HistoryEntry, string>;
  constructor() {
    // Marca renombrada: "devtool" → "estela" (aún no hay usuarios, sin migración).
    super("estela");
    this.version(1).stores({ history: "requestId, startedAt, method, status" });
  }
}

export const db = new DevtoolDB();

function truncatePreview(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  // Truncado en chars UTF-16 (String.length/slice), no en bytes: es un preview
  // para la UI, no un offset de lectura de archivo.
  return value.length > MAX_STORED_BODY ? value.slice(0, MAX_STORED_BODY) : value;
}

export function toHistoryEntry(input: HttpRequestInput, res: HttpResponseInfo): HistoryEntry {
  return {
    requestId: res.requestId,
    method: input.method,
    url: input.url,
    status: res.status,
    durationMs: res.durationMs,
    startedAt: Date.now(),
    backendRequestId: res.backendRequestId,
    requestHeaders: redactHeaders(input.headers),
    requestBody: truncatePreview(input.body),
    responseBody: truncatePreview(res.bodyText),
  };
}

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  await db.history.put(entry);
  await pruneHistory();
}

export async function listHistory(limit = 100): Promise<HistoryEntry[]> {
  return db.history.orderBy("startedAt").reverse().limit(limit).toArray();
}

export async function getHistory(requestId: string): Promise<HistoryEntry | undefined> {
  return db.history.get(requestId);
}

export async function pruneHistory(keep = 500): Promise<void> {
  const count = await db.history.count();
  if (count <= keep) {
    return;
  }
  const toDelete = await db.history.orderBy("startedAt").reverse().offset(keep).primaryKeys();
  await db.history.bulkDelete(toDelete);
}
