/* Líneas del rastro que la fuente Demo emite para cada request (puras,
   testables). Cada línea lleva `req=<id>` para que el correlador la
   asocie. Las líneas ambientales (healthcheck, gc, pool) no llevan id. */

export interface TrailRequestSpec {
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  /** Timestamp ISO-8601 para todas las líneas del rastro. */
  ts: string;
}

/** path de una URL (sin host). */
export function demoPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

/** Trail completo de un request: flechas + SQL/caché + (WARN/ERROR para 918). */
export function buildTrailRawLines(spec: TrailRequestSpec): string[] {
  const rid = spec.requestId;
  const path = demoPath(spec.url);
  const method = spec.method.toUpperCase();
  const lines: string[] = [];

  lines.push(`[${spec.ts}] INFO → ${method} ${path} req=${rid}`);

  if (method === "DELETE" && path === "/api/session") {
    lines.push(`[${spec.ts}] DEBUG cache invalidated key=session:* req=${rid}`);
  } else if (method === "POST") {
    lines.push(`[${spec.ts}] DEBUG INSERT INTO orders (total) VALUES (?) req=${rid}`);
    lines.push(`[${spec.ts}] DEBUG cache miss orders:detail req=${rid}`);
  } else if (path === "/api/orders/918") {
    lines.push(`[${spec.ts}] DEBUG SELECT * FROM orders WHERE id=918 req=${rid}`);
    lines.push(`[${spec.ts}] DEBUG serializando order 918 req=${rid}`);
    lines.push(`[${spec.ts}] WARN query lenta detectada · 849 ms req=${rid}`);
    lines.push(`[${spec.ts}] ERROR TypeError: Cannot read properties of undefined (reading 'items') at serializeOrder (orders.ts:88) req=${rid}`);
  } else {
    lines.push(`[${spec.ts}] DEBUG SELECT id, name, email FROM users LIMIT 20 req=${rid}`);
    lines.push(`[${spec.ts}] DEBUG cache hit users:list req=${rid}`);
  }

  lines.push(`[${spec.ts}] INFO ← ${spec.status} ${method} ${path} · ${Math.round(spec.durationMs)} ms req=${rid}`);
  return lines;
}

/** Líneas ambientales sin id (ruido intercalado del servidor). */
export const TRAIL_AMBIENT_MESSAGES: readonly string[] = [
  "healthcheck 127.0.0.1:8000 OK",
  "pool stats active=3 idle=7",
  "gc minor pass · 2 ms",
  "cache warm-up keys=12",
];

export function buildAmbientRawLine(ts: string, message: string): string {
  const level = message.startsWith("healthcheck") ? "INFO" : "DEBUG";
  return `[${ts}] ${level} ${message}`;
}
