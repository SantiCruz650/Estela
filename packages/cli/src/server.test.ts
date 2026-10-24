import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer as createHttpServer, request as httpRequest, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createCliServer, type CliServerOptions } from "./server.js";

const TOKEN = "test-token-0123456789abcdef";

interface RawResult {
  status: number;
  body: string;
  headers: NodeJS.Dict<string | string[]>;
}

/** http.request crudo para poder setear headers prohibidos en fetch (p. ej. Host). */
function rawRequest(
  port: number,
  opts: { method?: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        method: opts.method ?? "GET",
        path: opts.path,
        headers: opts.headers ?? {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    if (opts.body !== undefined) {
      req.write(opts.body);
    }
    req.end();
  });
}

function jsonResponse(result: RawResult): Record<string, unknown> {
  return JSON.parse(result.body) as Record<string, unknown>;
}

describe("createCliServer", () => {
  let tempRoot: string;
  let distDir: string;
  let logFile: string;
  let extraLog: string;
  const openServers: Server[] = [];

  async function startServer(opts: Partial<CliServerOptions> = {}): Promise<number> {
    const server = createCliServer({
      port: 0,
      distDir,
      logFiles: [logFile],
      token: TOKEN,
      ...opts,
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    return (server.address() as AddressInfo).port;
  }

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "estela-cli-"));
    distDir = join(tempRoot, "dist");
    await mkdir(distDir, { recursive: true });
    await writeFile(
      join(distDir, "index.html"),
      "<!doctype html><html><head><title>Estela</title></head><body>app</body></html>",
    );
    logFile = join(tempRoot, "app.log");
    extraLog = join(tempRoot, "secret.log");
    await writeFile(logFile, "line1 GET /api/users\nline2 POST /api/orders\n");
    await writeFile(extraLog, "top secret line\n");
  });

  afterEach(async () => {
    await Promise.all(
      openServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    await rm(tempRoot, { recursive: true, force: true });
  });

  describe("validación Host (anti DNS rebinding)", () => {
    it("rechaza con 403 un Host que no es localhost:PUERTO ni 127.0.0.1:PUERTO", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { Host: "attacker.example.com", "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_host");
    });

    it("rechaza con 403 un Host con puerto equivocado", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/",
        headers: { Host: "localhost:9999" },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_host");
    });

    it("acepta Host localhost:PUERTO y 127.0.0.1:PUERTO en /api/tail", async () => {
      const port = await startServer();
      const first = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { Host: `localhost:${port}`, "X-Estela-Token": TOKEN },
      });
      expect(first.status).toBe(200);
      const second = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { Host: `127.0.0.1:${port}`, "X-Estela-Token": TOKEN },
      });
      expect(second.status).toBe(200);
    });
  });

  describe("validación Origin", () => {
    it("GET /api/tail con Origin ajeno y token válido → 403", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { Origin: "https://evil.com", "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_origin");
    });

    it("POST /api/proxy con Origin ajeno y token válido → 403", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: "https://evil.com",
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method: "GET", url: "http://localhost:9/", headers: {}, requestId: "r1" }),
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_origin");
    });

    it("POST /api/proxy sin Origin → 403 (los navegadores siempre lo envían en POST)", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: { "X-Estela-Token": TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ method: "GET", url: "http://localhost:9/", headers: {}, requestId: "r1" }),
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("origin_required");
    });

    it("acepta Origin exacto en POST /api/proxy", async () => {
      const port = await startServer({
        fetchImpl: (async () =>
          new Response("ok", { status: 200, headers: { "content-type": "text/plain" } })) as typeof fetch,
      });
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method: "GET", url: "http://127.0.0.1:9999/hi", headers: {}, requestId: "r1" }),
      });
      expect(result.status).toBe(200);
      expect(jsonResponse(result).error).toBeUndefined();
    });
  });

  describe("validación de token", () => {
    it("GET /api/tail sin token → 403", async () => {
      const port = await startServer();
      const result = await rawRequest(port, { path: "/api/tail?offset=0" });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_token");
    });

    it("POST /api/proxy con Origin válido pero sin token → 403", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: { Origin: `http://localhost:${port}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method: "GET", url: "http://localhost:9/", headers: {}, requestId: "r1" }),
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_token");
    });

    it("token incorrecto → 403 (aunque el longitud sea igual)", async () => {
      const port = await startServer();
      const wrong = TOKEN.replace(/.$/, "x");
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { "X-Estela-Token": wrong },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_token");
    });

    it("el token viaja solo por header: query string con token no autentica", async () => {
      const port = await startServer();
      const result = await rawRequest(port, { path: `/api/tail?offset=0&token=${TOKEN}` });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("invalid_token");
    });

    it("inyecta el token en el HTML servido", async () => {
      const port = await startServer();
      const result = await rawRequest(port, { path: "/" });
      expect(result.status).toBe(200);
      expect(result.body).toContain(`window.__ESTELA_CLI_TOKEN__="${TOKEN}"`);
    });
  });

  describe("OPTIONS", () => {
    it("responde 403 sin headers CORS", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "OPTIONS",
        path: "/api/proxy",
        headers: { Origin: `http://localhost:${port}` },
      });
      expect(result.status).toBe(403);
      expect(result.headers["access-control-allow-origin"]).toBeUndefined();
      expect(result.headers["access-control-allow-headers"]).toBeUndefined();
    });

    it("nunca envía Access-Control-Allow-* en respuestas normales", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { "X-Estela-Token": TOKEN, Origin: `http://localhost:${port}` },
      });
      expect(result.status).toBe(200);
      for (const key of Object.keys(result.headers)) {
        expect(key.startsWith("access-control-")).toBe(false);
      }
    });
  });

  describe("GET /api/tail", () => {
    it("sin Origin (GET same-origin de navegador) con token válido → 200 con datos", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(200);
      const payload = result.body;
      expect(payload).toContain("line1 GET /api/users");
      const parsed = JSON.parse(payload) as { size: number; truncated: boolean };
      expect(parsed.size).toBeGreaterThan(0);
      expect(parsed.truncated).toBe(false);
    });

    it("rechaza con 403 una ruta de log no autorizada", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0&file=/etc/passwd",
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("log_not_authorized");
    });

    it("rechaza con 403 un archivo existente que no fue pasado con --log", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: `/api/tail?offset=0&file=${encodeURIComponent(extraLog)}`,
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("log_not_authorized");
      expect(result.body).not.toContain("top secret");
    });

    it("lee por nombre base un archivo autorizado", async () => {
      const port = await startServer({ logFiles: [logFile, extraLog] });
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0&file=secret.log",
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(200);
      expect(result.body).toContain("top secret line");
    });

    it("marca truncated cuando el offset supera el tamaño del archivo", async () => {
      const port = await startServer();
      const first = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { "X-Estela-Token": TOKEN },
      });
      const size = (JSON.parse(first.body) as { size: number }).size;
      const result = await rawRequest(port, {
        path: `/api/tail?offset=${size + 100}`,
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(200);
      expect(jsonResponse(result).truncated).toBe(true);
    });

    it("trunca la respuesta a 1 MB como máximo", async () => {
      const bigLog = join(tempRoot, "big.log");
      await writeFile(bigLog, "x".repeat(1_200_000));
      const port = await startServer({ logFiles: [bigLog] });
      const result = await rawRequest(port, {
        path: "/api/tail?offset=0",
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(200);
      const payload = JSON.parse(result.body) as { size: number; data: string };
      expect(payload.size).toBe(1_200_000);
      expect(payload.data.length).toBeLessThanOrEqual(1_000_000);
    });

    it("rechaza offset no numérico", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        path: "/api/tail?offset=abc",
        headers: { "X-Estela-Token": TOKEN },
      });
      expect(result.status).toBe(400);
      expect(jsonResponse(result).error).toBe("invalid_offset");
    });
  });

  describe("POST /api/proxy", () => {
    it("ejecuta la request y devuelve HttpResponseInfo con X-Request-ID inyectado", async () => {
      let receivedRequestIdHeader: string | undefined;
      const upstream = createHttpServer((req, res) => {
        receivedRequestIdHeader = typeof req.headers["x-request-id"] === "string"
          ? req.headers["x-request-id"]
          : undefined;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ requestId: "backend-42", users: ["ana"] }));
      });
      openServers.push(upstream);
      await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
      const upstreamPort = (upstream.address() as AddressInfo).port;

      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: `http://127.0.0.1:${upstreamPort}/api/users`,
          headers: {},
          requestId: "req-abc",
        }),
      });

      expect(result.status).toBe(200);
      const payload = JSON.parse(result.body) as {
        status: number;
        backendRequestId?: string;
        bodyText: string;
        error?: string;
      };
      expect(payload.status).toBe(200);
      expect(payload.backendRequestId).toBe("backend-42");
      expect(payload.bodyText).toContain("ana");
      expect(payload.error).toBeUndefined();
      expect(receivedRequestIdHeader).toBe("req-abc");
    });

    it("devuelve error: timeout cuando el destino no responde en plazo", async () => {
      const hangUpstream = createHttpServer(() => {
        // Nunca responde: fuerza el timeout del proxy.
      });
      openServers.push(hangUpstream);
      await new Promise<void>((resolve) => hangUpstream.listen(0, "127.0.0.1", () => resolve()));
      const hangPort = (hangUpstream.address() as AddressInfo).port;

      const port = await startServer({ requestTimeoutMs: 100 });
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: `http://127.0.0.1:${hangPort}/hang`,
          headers: {},
          requestId: "req-timeout",
        }),
      });

      expect(result.status).toBe(200);
      const payload = JSON.parse(result.body) as { status: number; error?: string; requestId: string };
      expect(payload.status).toBe(0);
      expect(payload.error).toBe("timeout");
      expect(payload.requestId).toBe("req-timeout");
    });

    it("rechaza con 403 destinos que no son localhost ni 127.0.0.1", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: "https://example.com/api",
          headers: {},
          requestId: "req-remote",
        }),
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("destination_not_allowed");
    });

    it("rechaza payloads con forma inválida", async () => {
      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method: "GET" }),
      });
      expect(result.status).toBe(400);
      expect(jsonResponse(result).error).toBe("invalid_payload");
    });

    it.each(["localhost.evil.com", "localhost.evil.com:8080", "127.0.0.1.nip.io", "0.0.0.0"])(
      "rechaza con 403 el destino spoofed %s",
      async (host) => {
        const port = await startServer();
        const result = await rawRequest(port, {
          method: "POST",
          path: "/api/proxy",
          headers: {
            Origin: `http://localhost:${port}`,
            "X-Estela-Token": TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            method: "GET",
            url: `http://${host}/api`,
            headers: {},
            requestId: "req-spoof",
          }),
        });
        expect(result.status).toBe(403);
        expect(jsonResponse(result).error).toBe("destination_not_allowed");
      },
    );

    it("acepta [::1] como destino loopback", async () => {
      const port = await startServer({
        fetchImpl: (async () =>
          new Response(JSON.stringify({ requestId: "b-1" }), { status: 200 })) as typeof fetch,
      });
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: "http://[::1]:9999/api",
          headers: {},
          requestId: "req-ipv6",
        }),
      });
      expect(result.status).toBe(200);
      expect(jsonResponse(result).error).toBeUndefined();
    });

    it("rechaza con 403 una redirección hacia un host que no es loopback", async () => {
      const upstream = createHttpServer((_req, res) => {
        res.writeHead(302, { Location: "http://evil.example.com/steal" });
        res.end();
      });
      openServers.push(upstream);
      await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
      const upstreamPort = (upstream.address() as AddressInfo).port;

      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: `http://127.0.0.1:${upstreamPort}/redir`,
          headers: {},
          requestId: "req-redir-evil",
        }),
      });
      expect(result.status).toBe(403);
      expect(jsonResponse(result).error).toBe("redirect_not_allowed");
    });

    it("sigue una redirección a otro loopback y devuelve la respuesta final", async () => {
      const finalUpstream = createHttpServer((req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ requestId: "final-7", via: req.url }));
      });
      openServers.push(finalUpstream);
      await new Promise<void>((resolve) => finalUpstream.listen(0, "127.0.0.1", () => resolve()));
      const finalPort = (finalUpstream.address() as AddressInfo).port;

      const redirectUpstream = createHttpServer((_req, res) => {
        res.writeHead(307, { Location: `http://127.0.0.1:${finalPort}/destino` });
        res.end();
      });
      openServers.push(redirectUpstream);
      await new Promise<void>((resolve) => redirectUpstream.listen(0, "127.0.0.1", () => resolve()));
      const redirectPort = (redirectUpstream.address() as AddressInfo).port;

      const port = await startServer();
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: `http://127.0.0.1:${redirectPort}/origen`,
          headers: {},
          requestId: "req-redir-ok",
        }),
      });
      expect(result.status).toBe(200);
      const payload = JSON.parse(result.body) as { status: number; backendRequestId?: string };
      expect(payload.status).toBe(200);
      expect(payload.backendRequestId).toBe("final-7");
    });

    it("usa redirect: manual (no sigue el redirect solo)", async () => {
      let seenRedirect: string | undefined;
      const upstream = createHttpServer((_req, res) => {
        res.writeHead(302, { Location: "http://127.0.0.1:1/nunca" });
        res.end();
      });
      openServers.push(upstream);
      await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
      const upstreamPort = (upstream.address() as AddressInfo).port;

      const port = await startServer({
        fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
          seenRedirect = init?.redirect as string | undefined;
          return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1:1/x" } });
        }) as typeof fetch,
      });
      const result = await rawRequest(port, {
        method: "POST",
        path: "/api/proxy",
        headers: {
          Origin: `http://localhost:${port}`,
          "X-Estela-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GET",
          url: `http://127.0.0.1:${upstreamPort}/x`,
          headers: {},
          requestId: "req-manual",
        }),
      });
      expect(result.status).toBe(200);
      expect(seenRedirect).toBe("manual");
      expect((JSON.parse(result.body) as { status: number }).status).toBe(302);
    });
  });

  describe("archivos estáticos", () => {
    it("sirve rutas SPA con index.html", async () => {
      const port = await startServer();
      const result = await rawRequest(port, { path: "/app" });
      expect(result.status).toBe(200);
      expect(result.body).toContain("window.__ESTELA_CLI_TOKEN__");
    });

    it("404 para assets inexistentes", async () => {
      const port = await startServer();
      const result = await rawRequest(port, { path: "/assets/missing.js" });
      expect(result.status).toBe(404);
    });
  });

  describe("red", () => {
    it("escucha únicamente en 127.0.0.1", async () => {
      const port = await startServer();
      const address = (openServers[openServers.length - 1]?.address() ?? null) as AddressInfo | null;
      expect(address?.address).toBe("127.0.0.1");
      expect(port).toBeGreaterThan(0);
    });
  });
});
