export interface HttpRequestInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  requestId: string;
}

export type RequestErrorKind = "network" | "timeout" | "aborted";

export interface HttpResponseInfo {
  requestId: string;
  backendRequestId?: string;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  bodyText: string;
  bodyTruncated: boolean;
  bytesRead: number;
  durationMs: number;
  error?: RequestErrorKind;
}

export const MAX_BODY_CHARS = 1_000_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface ExecuteRequestOptions {
  /** Timeout en ms; por defecto DEFAULT_REQUEST_TIMEOUT_MS. 0 o negativo = sin timeout. */
  timeoutMs?: number;
  /** Señal externa (p. ej. botón Cancelar): abortarla cancela la request. */
  signal?: AbortSignal;
}

function networkErrorResult(input: HttpRequestInput, t0: number, kind: RequestErrorKind): HttpResponseInfo {
  return {
    requestId: input.requestId,
    status: 0,
    statusText: "",
    responseHeaders: {},
    bodyText: "",
    bodyTruncated: false,
    bytesRead: 0,
    durationMs: performance.now() - t0,
    error: kind,
  };
}

/** Combina un timeout interno con una señal externa en un solo AbortSignal. */
function combineAbortSignals(timeoutMs: number, external?: AbortSignal): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs)
    : undefined;
  const onExternalAbort = (): void => {
    controller.abort();
  };
  if (external !== undefined) {
    if (external.aborted) {
      controller.abort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

export async function executeRequest(
  input: HttpRequestInput,
  fetcher: typeof fetch = fetch,
  options: ExecuteRequestOptions = {},
): Promise<HttpResponseInfo> {
  const headers: Record<string, string> = { ...input.headers };
  const hasRequestId = Object.keys(headers).some((key) => key.toLowerCase() === "x-request-id");
  if (!hasRequestId) {
    headers["X-Request-ID"] = input.requestId;
  }

  const methodUpper = input.method.toUpperCase();
  const body = methodUpper === "GET" || methodUpper === "HEAD" ? undefined : input.body;

  const t0 = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const { signal, didTimeout, dispose } = combineAbortSignals(timeoutMs, options.signal);

  try {
    if (signal.aborted) {
      return networkErrorResult(input, t0, didTimeout() ? "timeout" : "aborted");
    }

    let res: Response;
    try {
      res = await fetcher(input.url, { method: input.method, headers, body, signal });
    } catch {
      if (didTimeout()) {
        return networkErrorResult(input, t0, "timeout");
      }
      if (options.signal?.aborted === true) {
        return networkErrorResult(input, t0, "aborted");
      }
      return networkErrorResult(input, t0, "network");
    }

    let bodyTextFull: string;
    try {
      bodyTextFull = await res.text();
    } catch {
      if (didTimeout()) {
        return networkErrorResult(input, t0, "timeout");
      }
      if (options.signal?.aborted === true) {
        return networkErrorResult(input, t0, "aborted");
      }
      return networkErrorResult(input, t0, "network");
    }

    const truncated = bodyTextFull.length > MAX_BODY_CHARS;
    const bodyText = truncated ? bodyTextFull.slice(0, MAX_BODY_CHARS) : bodyTextFull;
    // bytesRead = longitud completa leída de la red (bodyTextFull.length), no la truncada.
    const bytesRead = bodyTextFull.length;

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of res.headers.entries()) {
      const prev = responseHeaders[key];
      responseHeaders[key] = prev === undefined ? value : `${prev}, ${value}`;
    }

    let backendRequestId: string | undefined;
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (typeof parsed === "object" && parsed !== null && "requestId" in parsed) {
        const candidate = (parsed as Record<string, unknown>)["requestId"];
        if (typeof candidate === "string") {
          backendRequestId = candidate;
        }
      }
    } catch {
      // Body no es JSON válido: se ignora sin tocar input.requestId.
    }

    return {
      requestId: input.requestId,
      backendRequestId,
      status: res.status,
      statusText: res.statusText,
      responseHeaders,
      bodyText,
      bodyTruncated: truncated,
      bytesRead,
      durationMs: performance.now() - t0,
    };
  } finally {
    dispose();
  }
}
