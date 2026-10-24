import { afterEach, describe, expect, it, vi } from "vitest";
import { executeRequestViaCli, fetchTailViaCli, CLI_TOKEN_HEADER } from "./cli-bridge";
import type { HttpResponseInfo } from "@devtool/core";

const TOKEN = "abc123";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("executeRequestViaCli", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST a /api/proxy con el token en header y devuelve HttpResponseInfo", async () => {
    const info: HttpResponseInfo = {
      requestId: "req-1",
      status: 200,
      statusText: "OK",
      responseHeaders: { "content-type": "application/json" },
      bodyText: "{\"ok\":true}",
      bodyTruncated: false,
      bytesRead: 12,
      durationMs: 5,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/proxy");
      expect(init?.method).toBe("POST");
      const headers = init?.headers as Record<string, string>;
      expect(headers[CLI_TOKEN_HEADER]).toBe(TOKEN);
      expect(headers["Content-Type"]).toBe("application/json");
      const body = JSON.parse(String(init?.body)) as { requestId: string };
      expect(body.requestId).toBe("req-1");
      return jsonResponse(info);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeRequestViaCli(
      { method: "GET", url: "http://localhost:3000/api", headers: {}, requestId: "req-1" },
      TOKEN,
    );
    expect(result).toEqual(info);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lanza con mensaje claro si el proxy responde 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "invalid_token" }, 403)));
    await expect(
      executeRequestViaCli({ method: "GET", url: "http://localhost:3000/api", headers: {}, requestId: "r" }, TOKEN),
    ).rejects.toThrow("El proxy del CLI rechazó la request (HTTP 403).");
  });

  it("lanza con mensaje claro si el CLI no responde (red caída)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(
      executeRequestViaCli({ method: "GET", url: "http://localhost:3000/api", headers: {}, requestId: "r" }, TOKEN),
    ).rejects.toThrow("No se pudo contactar con el CLI local");
  });

  it("propaga la señal de abort a fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      executeRequestViaCli(
        { method: "GET", url: "http://localhost:3000/api", headers: {}, requestId: "r" },
        TOKEN,
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchTailViaCli", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET a /api/tail con offset y token, devuelve {size,truncated,data}", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/tail?offset=42");
      const headers = init?.headers as Record<string, string>;
      expect(headers[CLI_TOKEN_HEADER]).toBe(TOKEN);
      return jsonResponse({ size: 100, truncated: false, data: "INFO x\n" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTailViaCli(42, TOKEN);
    expect(result).toEqual({ size: 100, truncated: false, data: "INFO x\n" });
  });

  it("lanza si el CLI responde con error HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "invalid_token" }, 403)));
    await expect(fetchTailViaCli(0, TOKEN)).rejects.toThrow("tail_error_403");
  });
});
