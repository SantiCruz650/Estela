import { describe, expect, it, vi } from "vitest";
import { executeRequest, MAX_BODY_CHARS } from "./http-client.js";
import type { HttpRequestInput } from "./http-client.js";

function mockResponse(opts: {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(opts.headers ?? {})) {
    headers.append(key, value);
  }
  return {
    status: opts.status ?? 200,
    statusText: opts.statusText ?? "OK",
    headers,
    text: async () => opts.body ?? "",
  } as Response;
}

function input(overrides: Partial<HttpRequestInput> = {}): HttpRequestInput {
  return {
    method: "GET",
    url: "https://api.test/users",
    headers: {},
    requestId: "our-id-1",
    ...overrides,
  };
}

describe("executeRequest", () => {
  it("a) GET inyecta X-Request-ID cuando no viene en headers", async () => {
    let sentHeaders: Record<string, string> | undefined;
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentHeaders = { ...((init?.headers as Record<string, string>) ?? {}) };
      return mockResponse({ body: "ok" });
    });

    await executeRequest(input(), fetcher as typeof fetch);

    expect(sentHeaders?.["X-Request-ID"]).toBe("our-id-1");
  });

  it("b) si headers ya traen x-request-id en minúsculas, NO se sobrescribe", async () => {
    let sentHeaders: Record<string, string> | undefined;
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentHeaders = { ...((init?.headers as Record<string, string>) ?? {}) };
      return mockResponse({ body: "ok" });
    });

    await executeRequest(input({ headers: { "x-request-id": "custom-123" } }), fetcher as typeof fetch);

    expect(sentHeaders?.["x-request-id"]).toBe("custom-123");
    const requestIdKeys = Object.keys(sentHeaders ?? {}).filter((k) => k.toLowerCase() === "x-request-id");
    expect(requestIdKeys).toHaveLength(1);
  });

  it("c) JSON con requestId del servidor va aparte sin tocar el nuestro", async () => {
    const fetcher = vi.fn(async () => mockResponse({ body: JSON.stringify({ requestId: "srv-123" }) }));

    const result = await executeRequest(input({ requestId: "our-id-9" }), fetcher as typeof fetch);

    expect(result.requestId).toBe("our-id-9");
    expect(result.backendRequestId).toBe("srv-123");
  });

  it("d) body gigante se trunca a MAX_BODY_CHARS", async () => {
    const big = "x".repeat(1_500_000);
    const fetcher = vi.fn(async () => mockResponse({ body: big }));

    const result = await executeRequest(input(), fetcher as typeof fetch);

    expect(MAX_BODY_CHARS).toBe(1_000_000);
    expect(result.bodyTruncated).toBe(true);
    expect(result.bodyText.length).toBe(1_000_000);
  });

  it("e) fetch que lanza TypeError devuelve error network con status 0 sin lanzar", async () => {
    const fetcher = vi.fn(async (): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    });

    const result = await executeRequest(input(), fetcher as typeof fetch);

    expect(result.error).toBe("network");
    expect(result.status).toBe(0);
    expect(result.requestId).toBe("our-id-1");
    expect(result.bodyText).toBe("");
    await expect(executeRequest(input(), fetcher as typeof fetch)).resolves.toBeDefined();
  });

  it("f) GET con input.body definido no envía body al fetch", async () => {
    let sentBody: unknown = "not-captured";
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = init?.body;
      return mockResponse({ body: "ok" });
    });

    await executeRequest(input({ method: "GET", body: "should-be-ignored" }), fetcher as typeof fetch);

    expect(sentBody).toBeUndefined();
  });

  it("g) timeout por defecto: si fetch no resuelve devuelve error timeout", async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const result = await executeRequest(input(), fetcher as typeof fetch, { timeoutMs: 10 });

    expect(result.error).toBe("timeout");
    expect(result.status).toBe(0);
    expect(result.requestId).toBe("our-id-1");
  });

  it("h) AbortSignal externo abortado devuelve error aborted", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const promise = executeRequest(input(), fetcher as typeof fetch, {
      signal: controller.signal,
      timeoutMs: 60_000,
    });
    controller.abort();
    const result = await promise;

    expect(result.error).toBe("aborted");
    expect(result.status).toBe(0);
  });

  it("i) el signal recibido por fetch es el combinado externo+timeout", async () => {
    let seenSignal: AbortSignal | undefined;
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      seenSignal = init?.signal ?? undefined;
      return mockResponse({ body: "ok" });
    });

    await executeRequest(input(), fetcher as typeof fetch, {
      signal: controller.signal,
      timeoutMs: 60_000,
    });

    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal?.aborted).toBe(false);
  });

  it("j) signal externo ya abortado no dispara fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn(async () => mockResponse({ body: "ok" }));

    const result = await executeRequest(input(), fetcher as typeof fetch, {
      signal: controller.signal,
      timeoutMs: 60_000,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.error).toBe("aborted");
  });
});
