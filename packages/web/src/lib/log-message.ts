/* Limpieza del mensaje visible en el panel (SOLO presentación: la línea
   cruda `raw` se conserva para búsqueda, correlación y exportación).
   - el nivel al inicio se oculta cuando coincide con el badge de la fila;
   - el sufijo `req=<id>` / `requestId=<id>` se oculta cuando el id es el
     que ya muestra la columna de id. */

export type MessageLevel = "debug" | "info" | "warn" | "error" | "unknown";

const LEVEL_TOKENS: Record<Exclude<MessageLevel, "unknown">, string> = {
  info: "INFO",
  debug: "DEBUG",
  warn: "WARN",
  error: "ERROR",
};

/** Prefijo `[timestamp] ` del formato típico de los servidores. */
const TIMESTAMP_PREFIX = /^\[[^\]]+\]\s*/;

const idPattern = (id: string): RegExp =>
  new RegExp(`\\s*(?:req|requestId)=${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$")}\\s*$`, "i");

/**
 * Texto a pintar en pantalla: sin prefijo `[ts]`, sin el token de nivel si
 * coincide con el badge y sin `req=<id>` / `requestId=<id>` cuando `<id>`
 * es el id que ya muestra la columna de id de esa fila.
 */
export function cleanLogMessage(
  raw: string,
  level: MessageLevel,
  /** Id de la columna de id (requestIds[0]) o undefined. */
  requestId: string | undefined,
): string {
  let text = raw.replace(TIMESTAMP_PREFIX, "");

  const token = level !== "unknown" ? LEVEL_TOKENS[level] : null;
  if (token !== null && new RegExp(`^${token}\\s+`, "i").test(text)) {
    text = text.replace(new RegExp(`^${token}`, "i"), "").trimStart();
  }

  if (requestId !== undefined && requestId !== "") {
    text = text.replace(idPattern(requestId), "");
  }

  return text.trimEnd();
}
