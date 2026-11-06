/* Líneas del rastro que la fuente Demo emite para cada request (puras,
   testables). Cada línea lleva `req=<id>` para que el correlador la
   asocie. Las líneas ambientales (healthcheck, gc, pool) no llevan id.
   B-13: las horas de las líneas del MISMO request son distintas y van
   repartidas dentro de la duración del request (no todas pegadas al
   mismo milisegundo). */

export interface TrailRequestSpec {
  requestId: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  /** Timestamp ISO-8601 del INICIO del request. */
  ts: string;
}

/** path de una URL (sin host). */
export function demoPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "");
}

/**
 * Generador de horas: posición fraccional (0..1) dentro de la duración.
 * Siempre estrictamente creciente (mínimo 1 ms entre líneas), incluso
 * cuando la duración es 0. Si el timestamp base no es parseable, cae a
 * la hora base sin offsets.
 */
function offsetClockAt(baseIso: string, durationMs: number): (frac: number) => string {
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base)) {
    return () => baseIso;
  }
  const duration = Math.max(0, Math.round(durationMs));
  let lastOffset = -1;
  return (frac: number): string => {
    const at = Math.min(duration, Math.round(frac * duration));
    lastOffset = Math.max(lastOffset + 1, at);
    return new Date(base + lastOffset).toISOString();
  };
}

/** Trail completo de un request: flechas + SQL/caché + (WARN/ERROR para 918). */
export function buildTrailRawLines(spec: TrailRequestSpec): string[] {
  const rid = spec.requestId;
  const path = demoPath(spec.url);
  const method = spec.method.toUpperCase();
  const clockAt = offsetClockAt(spec.ts, spec.durationMs);
  const lines: string[] = [];

  lines.push(`[${clockAt(0.03)}] INFO → ${method} ${path} req=${rid}`);

  if (method === "DELETE" && path === "/api/session") {
    lines.push(`[${clockAt(0.2)}] DEBUG cache invalidated key=session:* req=${rid}`);
  } else if (method === "POST") {
    lines.push(`[${clockAt(0.15)}] DEBUG INSERT INTO orders (total) VALUES (?) req=${rid}`);
    lines.push(`[${clockAt(0.35)}] DEBUG cache miss orders:detail req=${rid}`);
  } else if (path === "/api/orders/918") {
    lines.push(`[${clockAt(0.1)}] DEBUG SELECT * FROM orders WHERE id=918 req=${rid}`);
    lines.push(`[${clockAt(0.3)}] DEBUG serializando order 918 req=${rid}`);
    lines.push(`[${clockAt(0.62)}] WARN query lenta detectada · 849 ms req=${rid}`);
    lines.push(`[${clockAt(0.85)}] ERROR TypeError: Cannot read properties of undefined (reading 'items') at serializeOrder (orders.ts:88) req=${rid}`);
  } else {
    lines.push(`[${clockAt(0.12)}] DEBUG SELECT id, name, email FROM users LIMIT 20 req=${rid}`);
    lines.push(`[${clockAt(0.32)}] DEBUG cache hit users:list req=${rid}`);
  }

  lines.push(`[${clockAt(0.98)}] INFO ← ${spec.status} ${method} ${path} · ${Math.round(spec.durationMs)} ms req=${rid}`);
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
