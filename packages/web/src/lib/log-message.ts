/* Limpieza del mensaje visible en el panel (SOLO presentación: la línea
   cruda `raw` se conserva para búsqueda, correlación y exportación).
   - `req=<id>` / `requestId=<id>` del id de la columna se ocultan EN
     CUALQUIER posición (formato real: "… INFO req=<id> → GET /api/me");
   - el timestamp (con o sin corchetes) se oculta del inicio (ya vive en la
     columna de hora);
   - el token de nivel se oculta del inicio cuando coincide con el badge. */

export type MessageLevel = "debug" | "info" | "warn" | "error" | "unknown";

const LEVEL_TOKENS: Record<Exclude<MessageLevel, "unknown">, string> = {
  info: "INFO",
  debug: "DEBUG",
  warn: "WARN",
  error: "ERROR",
};

/** Prefijo `[timestamp] ` del formato con corchetes. */
const BRACKET_TIMESTAMP = /^\[[^\]]+\]\s*/;
/** ISO a secas al inicio ("2026-11-03T17:28:42.414Z …"), sin corchetes. */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\b\s*/;

const idTokenPattern = (id: string): RegExp =>
  new RegExp(`\\s*(?:req|requestId)=${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$")}`, "gi");

/**
 * Texto a pintar en pantalla: sin `[ts]` ni ISO inicial, sin el token de
 * nivel si coincide con el badge y sin `req=<id>` / `requestId=<id>` cuando
 * `<id>` es el id que ya muestra la columna de id de esa fila (cualquier
 * posición: inicio, medio o final).
 */
export function cleanLogMessage(
  raw: string,
  level: MessageLevel,
  /** Id de la columna de id (requestIds[0]) o undefined. */
  requestId: string | undefined,
): string {
  let text = raw.replace(BRACKET_TIMESTAMP, "").replace(ISO_TIMESTAMP, "");

  if (requestId !== undefined && requestId !== "") {
    text = text.replace(idTokenPattern(requestId), "").trimStart();
  }

  const token = level !== "unknown" ? LEVEL_TOKENS[level] : null;
  if (token !== null && new RegExp(`^${token}\\b`, "i").test(text.trimStart())) {
    text = text.trimStart().replace(new RegExp(`^${token}`, "i"), "").trimStart();
  }

  return text.replace(/\s{2,}/g, " ").trimEnd();
}
