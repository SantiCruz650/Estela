import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { BACKEND_ID_HINT, BACKEND_SNIPPETS } from "./backend-snippets";

/* Verificación REAL del fragmento Node (http): levanta un servidor ejecutando
   el código exacto del snippet y comprueba que la línea de log contiene el
   X-Request-ID del request. Los demás frameworks: revisados contra su
   documentación oficial; marcados en el reporte como "no ejecutados". */

const NODE_SNIPPET = BACKEND_SNIPPETS.find((snippet) => snippet.id === "node");
if (NODE_SNIPPET === undefined) {
  throw new Error("snippet de Node ausente");
}

const nodeRequire = createRequire(import.meta.url);

function rawRequest(
  port: number,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, headers }, (res) => {
      res.resume();
      res.on("end", () => {
        const responseHeaders: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          responseHeaders[key] = value;
        }
        resolve({ status: res.statusCode ?? 0, headers: responseHeaders });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

describe("backend-snippets", () => {
  it("explica que el ID se reconoce en cualquier formato y en cualquier parte", () => {
    expect(BACKEND_ID_HINT).toContain("npx @estela-dev/cli");
    expect(BACKEND_ID_HINT).toContain("cualquier formato");
    expect(BACKEND_ID_HINT).toContain("cualquier parte");
  });

  it("incluye un fragmento por cada framework pedido", () => {
    expect(BACKEND_SNIPPETS.map((snippet) => snippet.id)).toEqual([
      "node",
      "express",
      "fastify",
      "nextjs",
      "nestjs",
      "flask",
      "fastapi",
      "django",
    ]);
    for (const snippet of BACKEND_SNIPPETS) {
      expect(snippet.code).toContain("X-Request-ID");
      expect(snippet.code.trim().length).toBeGreaterThan(40);
      expect(typeof snippet.verified).toBe("boolean");
    }
  });

  describe("fragmento Node (http) verificado con servidor real", () => {
    let consoleLogs: string[];
    let logSpy: ReturnType<typeof vi.spyOn>;

    /** Ejecuta el código del snippet tal cual (CommonJS con require/process). */
    function startSnippetServer(): Server {
      const runSnippet = new Function(
        "require",
        "process",
        `${NODE_SNIPPET!.code}\n;return server;`,
      );
      const shimProcess = { env: { ...process.env, PORT: "0" } };
      const server = runSnippet(nodeRequire, shimProcess) as Server | undefined;
      if (server === undefined || server === null) {
        throw new Error("el snippet no devolvió el servidor levantado");
      }
      return server;
    }

    async function listenPort(server: Server): Promise<number> {
      const immediate = server.address();
      if (immediate !== null && typeof immediate === "object") {
        return immediate.port;
      }
      const address = await new Promise<AddressInfo>((resolve, reject) => {
        server.once("listening", () => resolve(server.address() as AddressInfo));
        server.once("error", reject);
      });
      return address.port;
    }

    beforeEach(() => {
      consoleLogs = [];
      logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        consoleLogs.push(args.map((arg) => String(arg)).join(" "));
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it("el id enviado como header llega a la respuesta y a la línea de log", async () => {
      const server = startSnippetServer();
      let port: number;
      try {
        port = await listenPort(server);
        const result = await rawRequest(port, "/api/users", {
          "x-request-id": "estela-verificacion-7f3a",
        });
        expect(result.status).toBe(200);
        expect(String(result.headers["x-request-id"])).toBe("estela-verificacion-7f3a");
        expect(consoleLogs.join("\n")).toContain(`req=estela-verificacion-7f3a ${"GET"} /api/users`);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("sin header X-Request-ID, genera un id y lo devuelve y loguea igual", async () => {
      const server = startSnippetServer();
      let port: number;
      try {
        port = await listenPort(server);
        const result = await rawRequest(port, "/ping", {});
        expect(result.status).toBe(200);
        const echoedId = String(result.headers["x-request-id"]);
        expect(echoedId.length).toBeGreaterThan(0);
        const logLine = consoleLogs.find((line) => line.startsWith("req="));
        expect(logLine?.includes(`req=${echoedId}`)).toBe(true);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
