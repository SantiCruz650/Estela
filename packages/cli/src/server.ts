import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { open, readFile, stat } from "node:fs/promises";
import { basename, extname, join, normalize, resolve, sep } from "node:path";

/** Header único de autenticación. Nunca por query string ni cookie. */
export const CLI_TOKEN_HEADER = "x-estela-token";

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
/** Tope de body leído del destino en POST /api/proxy. */
export const MAX_PROXY_BODY_CHARS = 1_000_000;
/** Tope de bytes devueltos por GET /api/tail por respuesta. */
export const MAX_TAIL_BYTES = 1_000_000;
/** Tope del body entrante hacia /api/proxy. */
export const MAX_PROXY_REQUEST_CHARS = 10_000_000;

export interface ProxyRequestInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  requestId: string;
}

export type ProxyErrorKind = "network" | "timeout";

export interface ProxyResponse {
  requestId: string;
  backendRequestId?: string;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  bodyText: string;
  bodyTruncated: boolean;
  bytesRead: number;
  durationMs: number;
  error?: ProxyErrorKind;
}

export interface TailResponse {
  size: number;
  truncated: boolean;
  data: string;
}

export interface CliServerOptions {
  /** Puerto TCP lógico para las validaciones Host/Origin. 0 = efímero (tests). */
  port: number;
  /** Directorio con el build de packages/web/dist. */
  distDir: string;
  /** Rutas absolutas de los únicos archivos que /api/tail puede leer. */
  logFiles: readonly string[];
  /** Token aleatorio exigido en cada /api/*. */
  token: string;
  requestTimeoutMs?: number;
  maxTailBytes?: number;
  maxProxyRequestChars?: number;
  fetchImpl?: typeof fetch;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

/** Compara dos strings sin filtrar longitud ni contenido por timing (usa SHA-256 + timingSafeEqual). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/** Inyecta el token como variable global en el HTML servido (nunca se escribe a disco). */
export function injectCliToken(html: string, token: string): string {
  const script = `<script>window.__ESTELA_CLI_TOKEN__=${JSON.stringify(token)};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }
  return script + html;
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.length;
    if (total > limit) {
      throw new Error("body_too_large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isProxyRequestInput(value: unknown): value is ProxyRequestInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.method !== "string" || record.method.length === 0) {
    return false;
  }
  if (typeof record.url !== "string" || record.url.length === 0) {
    return false;
  }
  if (typeof record.requestId !== "string" || record.requestId.length === 0) {
    return false;
  }
  if (typeof record.headers !== "object" || record.headers === null || Array.isArray(record.headers)) {
    return false;
  }
  for (const headerValue of Object.values(record.headers as Record<string, unknown>)) {
    if (typeof headerValue !== "string") {
      return false;
    }
  }
  if (record.body !== undefined && typeof record.body !== "string") {
    return false;
  }
  return true;
}

function proxyErrorResult(input: ProxyRequestInput, t0: number, kind: ProxyErrorKind): ProxyResponse {
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

function isLoopbackHost(hostname: string): boolean {
  // Comparación EXACTA del hostname: localhost.evil.com o 127.0.0.1.nip.io no entran.
  // new URL("http://[::1]/").hostname === "[::1]" (con corchetes).
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * fetch con redirect: "manual" revalidando el hostname en CADA salto.
 * Si una redirección apunta fuera de loopback, se corta con error.
 */
async function fetchWithManualRedirects(
  fetchImpl: typeof fetch,
  initialUrl: URL,
  init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal },
): Promise<{ response: Response; error?: "redirect_not_allowed" }> {
  let currentUrl = initialUrl;
  let method = init.method;
  let body = init.body;

  const doFetch = (): Promise<Response> =>
    fetchImpl(currentUrl.toString(), {
      method,
      headers: init.headers,
      body,
      signal: init.signal,
      redirect: "manual",
    });

  let response = await doFetch();
  for (let hop = 0; hop < MAX_REDIRECTS && REDIRECT_STATUSES.has(response.status); hop++) {
    const location = response.headers.get("location");
    if (location === null) {
      break;
    }
    let next: URL;
    try {
      next = new URL(location, currentUrl);
    } catch {
      break;
    }
    if (!isLoopbackHost(next.hostname)) {
      return { response, error: "redirect_not_allowed" };
    }
    if (
      response.status === 303
      || ((response.status === 301 || response.status === 302) && method !== "GET" && method !== "HEAD")
    ) {
      method = "GET";
      body = undefined;
    }
    currentUrl = next;
    response = await doFetch();
  }
  return { response };
}

export function createCliServer(options: CliServerOptions): Server {
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxTailBytes = options.maxTailBytes ?? MAX_TAIL_BYTES;
  const maxProxyRequestChars = options.maxProxyRequestChars ?? MAX_PROXY_REQUEST_CHARS;
  const fetchImpl: typeof fetch = options.fetchImpl ?? fetch;
  const logFiles = options.logFiles.map((file) => resolve(file));

  const server = createServer((req, res) => {
    void handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal" });
      } else {
        res.end();
      }
    });
  });

  /** Puerto real asignado por el OS (soporta port 0 en tests). */
  function currentPort(): number {
    const address = server.address();
    return typeof address === "object" && address !== null ? address.port : options.port;
  }

  function allowedOrigins(port: number): ReadonlySet<string> {
    return new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
  }

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? "GET").toUpperCase();

    // Nunca respondemos con headers CORS: mismo origen únicamente.
    if (method === "OPTIONS") {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    const port = currentPort();

    // Anti DNS rebinding: solo localhost:PUERTO y 127.0.0.1:PUERTO.
    const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
    if (host !== `localhost:${port}` && host !== `127.0.0.1:${port}`) {
      sendJson(res, 403, { error: "invalid_host" });
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      if (origin !== undefined) {
        if (!allowedOrigins(port).has(origin)) {
          sendJson(res, 403, { error: "invalid_origin" });
          return;
        }
      } else if (method !== "GET" && method !== "HEAD") {
        // El navegador SIEMPRE envía Origin en POST same-origin: exigirlo aquí es gratis.
        sendJson(res, 403, { error: "origin_required" });
        return;
      }

      // Token obligatorio en todo /api/* (solo header, con comparación constante).
      const tokenHeader = req.headers[CLI_TOKEN_HEADER];
      if (typeof tokenHeader !== "string" || !timingSafeStringEqual(tokenHeader, options.token)) {
        sendJson(res, 403, { error: "invalid_token" });
        return;
      }

      if (path === "/api/proxy") {
        if (method !== "POST") {
          sendJson(res, 405, { error: "method_not_allowed" });
          return;
        }
        await handleProxy(req, res);
        return;
      }

      if (path === "/api/tail") {
        if (method !== "GET") {
          sendJson(res, 405, { error: "method_not_allowed" });
          return;
        }
        await handleTail(url, res);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    await serveStatic(path, res, method === "HEAD");
  }

  async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let raw: string;
    try {
      raw = await readBody(req, maxProxyRequestChars);
    } catch {
      sendJson(res, 413, { error: "request_too_large" });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
    if (!isProxyRequestInput(parsed)) {
      sendJson(res, 400, { error: "invalid_payload" });
      return;
    }

    let destination: URL;
    try {
      destination = new URL(parsed.url);
    } catch {
      sendJson(res, 400, { error: "invalid_url" });
      return;
    }
    // Por defecto solo destinos loopback.
    if (!isLoopbackHost(destination.hostname)) {
      sendJson(res, 403, { error: "destination_not_allowed" });
      return;
    }

    const headers: Record<string, string> = { ...parsed.headers };
    const hasRequestId = Object.keys(headers).some((key) => key.toLowerCase() === "x-request-id");
    if (!hasRequestId) {
      headers["X-Request-ID"] = parsed.requestId;
    }

    const methodUpper = parsed.method.toUpperCase();
    const body = methodUpper === "GET" || methodUpper === "HEAD" ? undefined : parsed.body;

    const t0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      let upstream: Response;
      try {
        const result = await fetchWithManualRedirects(fetchImpl, destination, {
          method: methodUpper,
          headers,
          body,
          signal: controller.signal,
        });
        if (result.error === "redirect_not_allowed") {
          sendJson(res, 403, { error: "redirect_not_allowed" });
          return;
        }
        upstream = result.response;
      } catch {
        sendJson(res, 200, proxyErrorResult(parsed, t0, controller.signal.aborted ? "timeout" : "network"));
        return;
      }

      let fullText: string;
      try {
        fullText = await upstream.text();
      } catch {
        sendJson(res, 200, proxyErrorResult(parsed, t0, controller.signal.aborted ? "timeout" : "network"));
        return;
      }

      const truncated = fullText.length > MAX_PROXY_BODY_CHARS;
      const bodyText = truncated ? fullText.slice(0, MAX_PROXY_BODY_CHARS) : fullText;

      const responseHeaders: Record<string, string> = {};
      for (const [key, value] of upstream.headers.entries()) {
        const previous = responseHeaders[key];
        responseHeaders[key] = previous === undefined ? value : `${previous}, ${value}`;
      }

      let backendRequestId: string | undefined;
      try {
        const jsonBody: unknown = JSON.parse(bodyText);
        if (typeof jsonBody === "object" && jsonBody !== null && "requestId" in jsonBody) {
          const candidate = (jsonBody as Record<string, unknown>)["requestId"];
          if (typeof candidate === "string") {
            backendRequestId = candidate;
          }
        }
      } catch {
        // Body no es JSON válido: se ignora sin tocar requestId.
      }

      sendJson(res, 200, {
        requestId: parsed.requestId,
        backendRequestId,
        status: upstream.status,
        statusText: upstream.statusText,
        responseHeaders,
        bodyText,
        bodyTruncated: truncated,
        bytesRead: fullText.length,
        durationMs: performance.now() - t0,
      } satisfies ProxyResponse);
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleTail(url: URL, res: ServerResponse): Promise<void> {
    const offsetRaw = url.searchParams.get("offset") ?? "0";
    const offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) {
      sendJson(res, 400, { error: "invalid_offset" });
      return;
    }

    const fileParam = url.searchParams.get("file");
    let target: string;
    if (fileParam === null) {
      if (logFiles.length === 0) {
        sendJson(res, 404, { error: "no_log_files" });
        return;
      }
      target = logFiles[0];
    } else {
      // Solo archivos pasados con --log: nunca rutas crudas del cliente.
      const resolvedParam = resolve(fileParam);
      const allowed = logFiles.find(
        (file) => file === resolvedParam || basename(file) === fileParam,
      );
      if (allowed === undefined) {
        sendJson(res, 403, { error: "log_not_authorized" });
        return;
      }
      target = allowed;
    }

    let size: number;
    try {
      const stats = await stat(target);
      size = stats.size;
    } catch {
      sendJson(res, 404, { error: "log_unreadable" });
      return;
    }

    const truncated = offset > size;
    const from = truncated ? 0 : offset;
    const to = Math.min(from + maxTailBytes, size);
    const length = to - from;

    let data = "";
    if (length > 0) {
      const handle = await open(target, "r");
      try {
        const buffer = Buffer.alloc(length);
        let position = 0;
        while (position < length) {
          const { bytesRead } = await handle.read(buffer, position, length - position, from + position);
          if (bytesRead === 0) {
            break;
          }
          position += bytesRead;
        }
        data = buffer.subarray(0, position).toString("utf8");
      } finally {
        await handle.close();
      }
    }

    const payload: TailResponse = { size, truncated, data };
    sendJson(res, 200, payload);
  }

  async function serveStatic(path: string, res: ServerResponse, headOnly: boolean): Promise<void> {
    const distRoot = resolve(options.distDir);
    const requestedPath = path === "/" ? "/index.html" : normalize(path);
    let filePath = resolve(join(distRoot, `.${requestedPath}`));
    if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
      sendJson(res, 403, { error: "invalid_path" });
      return;
    }

    let content: Buffer;
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        throw new Error("not_a_file");
      }
      content = await readFile(filePath);
    } catch {
      if (extname(filePath) !== "") {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      // SPA fallback: React Router sirve /app desde index.html.
      filePath = join(distRoot, "index.html");
      try {
        content = await readFile(filePath);
      } catch {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
    }

    const isHtml = extname(filePath) === ".html";
    const body = isHtml ? Buffer.from(injectCliToken(content.toString("utf8"), options.token)) : content;
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
      "Content-Length": body.byteLength,
      "Cache-Control": "no-store",
    });
    if (headOnly) {
      res.end();
      return;
    }
    res.end(body);
  }

  return server;
}
