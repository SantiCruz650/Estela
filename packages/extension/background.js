const VERSION = "0.1.0";
const MAX_BODY_CHARS = 1_000_000;

// Orígenes permitidos para enviar mensajes al service worker (mismos que content_scripts.matches).
const ALLOWED_SENDER_ORIGINS = new Set([
  "https://esteladev.netlify.app",
  "http://localhost",
  "http://127.0.0.1",
]);

function isAllowedSender(sender) {
  const origin = sender?.origin ?? (sender?.url ? new URL(sender.url).origin : "");
  return ALLOWED_SENDER_ORIGINS.has(origin);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!isAllowedSender(sender)) {
    return false;
  }
  if (msg?.type === "PING") {
    sendResponse({ version: VERSION });
    return false;
  }
  if (msg?.type === "EXECUTE_REQUEST") {
    executeRequest(msg.payload)
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          requestId: msg.payload?.requestId,
          status: 0,
          statusText: "",
          responseHeaders: {},
          bodyText: "",
          bodyTruncated: false,
          bytesRead: 0,
          durationMs: 0,
          error: "network",
        }),
      );
    return true; // respuesta asíncrona
  }
  return false;
});

async function executeRequest(payload) {
  // Replica EXACTA de la semántica de packages/core/src/http-client.ts:
  // 1. Copia payload.headers; si ninguna clave es "x-request-id" (case-insensitive), añade X-Request-ID: payload.requestId.
  const headers = { ...(payload.headers || {}) };
  const hasRequestId = Object.keys(headers).some((key) => key.toLowerCase() === "x-request-id");
  if (!hasRequestId) {
    headers["X-Request-ID"] = payload.requestId;
  }
  // 2. const t0 = performance.now(). Si method es GET o HEAD, no enviar body.
  const t0 = performance.now();
  const methodUpper = String(payload.method || "GET").toUpperCase();
  const body = methodUpper === "GET" || methodUpper === "HEAD" ? undefined : payload.body;
  // 3. fetch(payload.url, { method, headers, body }).
  const res = await fetch(payload.url, { method: payload.method, headers, body });
  // 4. const full = await res.text(); bodyText truncado a MAX_BODY_CHARS.
  const full = await res.text();
  const truncated = full.length > MAX_BODY_CHARS;
  const bodyText = truncated ? full.slice(0, MAX_BODY_CHARS) : full;
  const bodyTruncated = truncated;
  // 5. responseHeaders: objeto plano iterando res.headers.entries(); claves repetidas unir con ", ".
  const responseHeaders = {};
  for (const [key, value] of res.headers.entries()) {
    if (responseHeaders[key] === undefined) {
      responseHeaders[key] = value;
    } else {
      responseHeaders[key] = responseHeaders[key] + ", " + value;
    }
  }
  // 6. backendRequestId: intenta JSON.parse(bodyText); si objeto con campo requestId string, capturarlo. NUNCA mutar payload.requestId.
  let backendRequestId;
  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed === "object" && parsed !== null && "requestId" in parsed) {
      const candidate = parsed.requestId;
      if (typeof candidate === "string") {
        backendRequestId = candidate;
      }
    }
  } catch {
    // Body no JSON: se ignora sin tocar payload.requestId.
  }
  // 7. durationMs = performance.now() - t0.
  const durationMs = performance.now() - t0;
  // 8. Devuelve el objeto de respuesta con bytesRead: full.length.
  return {
    requestId: payload.requestId,
    backendRequestId,
    status: res.status,
    statusText: res.statusText,
    responseHeaders,
    bodyText,
    bodyTruncated,
    bytesRead: full.length,
    durationMs,
  };
  // 9. Si fetch lanza: propaga (el catch del listener lo convierte en error "network").
}
