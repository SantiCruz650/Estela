/* Modo demo: responder requests sin red y emitir el rastro de cada uno.
   El responder es una función pura sobre (método, ruta, id): la UI lo
   llama con una latencia simulada de 6-900 ms. */

import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";

export interface DemoRouteResponse {
  status: number;
  statusText: string;
  bodyText: string;
  contentType: string;
  /** Latencia simulada (ms). Diferente entre rutas, realista. */
  delayMs: number;
}

const USERS_BODY = JSON.stringify([
  { id: 1, name: "Ada Lovelace", email: "ada@estela.dev" },
  { id: 2, name: "Lin Chen", email: "lin@estela.dev" },
]);

const ORDERS_CREATED_BODY = JSON.stringify({ id: 918, status: "created", total: 42.5 });

function inRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

/** Responder rutas demo (sin red, en memoria). */
export function demoResponseFor(method: string, url: string, requestId: string): DemoRouteResponse {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const upper = method.toUpperCase();

  if (upper === "GET" && path === "/api/users") {
    return { status: 200, statusText: "OK", bodyText: USERS_BODY, contentType: "application/json; charset=utf-8", delayMs: inRange(6, 200) };
  }
  if (upper === "POST" && path === "/api/orders") {
    return { status: 201, statusText: "Created", bodyText: ORDERS_CREATED_BODY, contentType: "application/json; charset=utf-8", delayMs: inRange(60, 400) };
  }
  if (upper === "GET" && path === "/api/orders/918") {
    const body = JSON.stringify({
      error: "internal_error",
      requestId,
      message: "Cannot read properties of undefined (reading 'items')",
    });
    return { status: 500, statusText: "Internal Server Error", bodyText: body, contentType: "application/json; charset=utf-8", delayMs: 849 };
  }
  if (upper === "DELETE" && path === "/api/session") {
    return { status: 204, statusText: "No Content", bodyText: "", contentType: "text/plain", delayMs: inRange(6, 120) };
  }
  const notFound = JSON.stringify({ error: "not_found", method: upper, path });
  return { status: 404, statusText: "Not Found", bodyText: notFound, contentType: "application/json; charset=utf-8", delayMs: inRange(20, 120) };
}

/** Ejecuta el responder demo con latencia simulada (no red). */
export async function respondDemo(
  input: HttpRequestInput,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<HttpResponseInfo> {
  const route = demoResponseFor(input.method, input.url, input.requestId);
  await sleep(route.delayMs);
  return {
    requestId: input.requestId,
    status: route.status,
    statusText: route.statusText,
    responseHeaders: {
      "content-type": route.contentType,
      "x-request-id": input.requestId,
    },
    bodyText: route.bodyText,
    bodyTruncated: false,
    bytesRead: route.bodyText.length,
    durationMs: route.delayMs,
  };
}
