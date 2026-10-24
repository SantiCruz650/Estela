import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";

const TAG = "devtool-webapp";
const EXT_TAG = "devtool-extension";
const PING_TIMEOUT_MS = 600;
const REQUEST_TIMEOUT_MS = 30_000;

interface BridgeMessage {
  source?: unknown;
  type?: unknown;
  requestId?: unknown;
  response?: unknown;
  bridgeError?: unknown;
}

/**
 * Decide si un MessageEvent del bridge es de confianza.
 * Reglas: mismo origen que la página y source === window (no iframes ni popups).
 * Exportado puro para poder testearlo sin DOM.
 */
export function isTrustedBridgeEvent(
  origin: string,
  source: unknown,
  expectedOrigin: string,
  expectedSource: unknown,
): boolean {
  return origin === expectedOrigin && source === expectedSource;
}

function post(msg: unknown): void {
  window.postMessage(msg, window.location.origin);
}

function waitForMessage<T>(
  type: string,
  predicate: (m: BridgeMessage) => boolean,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, timeoutMs);

    function onAbort(): void {
      cleanup();
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }

    function onMessage(event: MessageEvent): void {
      if (!isTrustedBridgeEvent(event.origin, event.source, window.location.origin, window)) {
        return;
      }
      const data = event.data as BridgeMessage | null | undefined;
      if (data === null || data === undefined || typeof data !== "object") {
        return;
      }
      if (data.source !== EXT_TAG || data.type !== type) {
        return;
      }
      let ok: boolean;
      try {
        ok = predicate(data);
      } catch {
        return;
      }
      if (!ok) {
        return;
      }
      cleanup();
      resolve(data as unknown as T);
    }

    function cleanup(): void {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      signal?.removeEventListener("abort", onAbort);
    }

    window.addEventListener("message", onMessage);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function isExtensionAvailable(): Promise<boolean> {
  post({ source: TAG, type: "DEVTOOL_PING" });
  try {
    await waitForMessage<BridgeMessage>("DEVTOOL_PONG", () => true, PING_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

export async function executeRequestViaExtension(
  input: HttpRequestInput,
  signal?: AbortSignal,
): Promise<HttpResponseInfo> {
  if (signal?.aborted === true) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  post({ source: TAG, type: "EXECUTE_REQUEST", payload: input });
  const msg = await waitForMessage<BridgeMessage>(
    "EXECUTE_RESPONSE",
    (m) => m.requestId === input.requestId,
    REQUEST_TIMEOUT_MS,
    signal,
  );
  if (msg.bridgeError !== null && msg.bridgeError !== undefined) {
    throw new Error(typeof msg.bridgeError === "string" ? msg.bridgeError : "bridgeError");
  }
  if (msg.response === null || msg.response === undefined) {
    throw new Error("bridgeError");
  }
  return msg.response as HttpResponseInfo;
}
