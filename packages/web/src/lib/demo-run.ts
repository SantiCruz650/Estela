import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";
import { respondDemo } from "./demo";
import { demoTrailBus } from "./demo-source";
import { saveHistory, toHistoryEntry } from "./db";
import { newRequestId } from "./request-id";
import { useCorrelationStore } from "./correlation-store";
import { useResponseStore } from "./response-store";

/* Secuencia de demo: dispara los 4 requests de ejemplo con sus rastros
   (~600 ms de separación) y deja seleccionado GET /api/orders/918. */

const DEMO_BASE = "http://localhost:3000";

export const DEMO_REQUESTS: ReadonlyArray<{ method: string; url: string }> = [
  { method: "GET", url: `${DEMO_BASE}/api/users` },
  { method: "POST", url: `${DEMO_BASE}/api/orders` },
  { method: "GET", url: `${DEMO_BASE}/api/orders/918` },
  { method: "DELETE", url: `${DEMO_BASE}/api/session` },
];

const DEMO_SLOW_URL = `${DEMO_BASE}/api/orders/918`;

interface DemoRunHooks {
  sleep: (ms: number) => Promise<void>;
}

const defaultHooks: DemoRunHooks = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Ejecuta un request por el responder demo, registra en store + historial
 *  y emite su rastro por el bus. Devuelve la respuesta. */
export async function dispatchDemoRequest(input: HttpRequestInput): Promise<HttpResponseInfo> {
  const res = await respondDemo(input);
  useCorrelationStore.getState().recordRequest({
    requestId: input.requestId,
    method: input.method,
    url: input.url,
    statusCode: res.status,
    startedAt: Date.now(),
    durationMs: res.durationMs,
  });
  demoTrailBus.emit({
    requestId: input.requestId,
    method: input.method,
    url: input.url,
    status: res.status,
    durationMs: res.durationMs,
  });
  try {
    await saveHistory(toHistoryEntry(input, res));
  } catch {
    // sin persistencia (SSR/CI), la demo sigue funcionando
  }
  return res;
}

/** Dispara los 4 requests demo en secuencia y deja seleccionado el 918. */
let sequenceInFlight = false;

export async function runDemoSequence(hooks: DemoRunHooks = defaultHooks): Promise<void> {
  // Una sola secuencia a la vez (evita duplicados por StrictMode/mounts).
  if (sequenceInFlight) {
    return;
  }
  // Si ya hay requests demo (recarga/re-mount), no repite.
  if (useCorrelationStore.getState().requests.some((r) => r.url.startsWith(DEMO_BASE))) {
    return;
  }
  sequenceInFlight = true;
  try {
    let slow: HttpResponseInfo | null = null;
    let slowInput: HttpRequestInput | null = null;
    for (const spec of DEMO_REQUESTS) {
      const input: HttpRequestInput = {
        method: spec.method,
        url: spec.url,
        headers: {},
        requestId: newRequestId(),
      };
      const res = await dispatchDemoRequest(input);
      if (spec.url === DEMO_SLOW_URL) {
        slow = res;
        slowInput = input;
      }
      await hooks.sleep(600);
    }
    if (slow !== null && slowInput !== null) {
      useResponseStore.getState().setResponse(slow, slowInput);
      useCorrelationStore.getState().selectRequest(slow.requestId);
    }
  } finally {
    sequenceInFlight = false;
  }
}
