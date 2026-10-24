import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, getHistory, listHistory, MAX_STORED_BODY, pruneHistory, redactHeaders, saveHistory, toHistoryEntry } from "./db";
import type { HistoryEntry } from "./db";

function entry(requestId: string, startedAt: number): HistoryEntry {
  return {
    requestId,
    method: "GET",
    url: "https://api.test/users",
    status: 200,
    durationMs: 10,
    startedAt,
  };
}

beforeEach(async () => {
  await db.history.clear();
});

describe("history db", () => {
  it("a) toHistoryEntry copia campos y trunca body de 15_000 chars a 10_000", () => {
    expect(MAX_STORED_BODY).toBe(10_000);
    const result = toHistoryEntry(
      {
        method: "POST",
        url: "https://api.test/users",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(15_000),
        requestId: "our-id-1",
      },
      {
        requestId: "our-id-1",
        backendRequestId: "srv-1",
        status: 201,
        statusText: "Created",
        responseHeaders: {},
        bodyText: "y".repeat(15_000),
        bodyTruncated: true,
        bytesRead: 15_000,
        durationMs: 12,
      },
    );

    expect(result.requestId).toBe("our-id-1");
    expect(result.method).toBe("POST");
    expect(result.url).toBe("https://api.test/users");
    expect(result.status).toBe(201);
    expect(result.backendRequestId).toBe("srv-1");
    expect(result.requestBody?.length).toBe(10_000);
    expect(result.responseBody?.length).toBe(10_000);
  });

  it("b) saveHistory + getHistory devuelven la entrada guardada", async () => {
    await saveHistory(entry("id-1", 100));

    expect(await getHistory("id-1")).toMatchObject({ requestId: "id-1", startedAt: 100 });
  });

  it("c) pruneHistory(3) conserva solo los 3 más recientes ordenados desc", async () => {
    for (const startedAt of [1, 2, 3, 4, 5]) {
      await saveHistory(entry(`id-${startedAt}`, startedAt));
    }
    await pruneHistory(3);

    const rows = await listHistory(10);
    expect(rows.map((row) => row.requestId)).toEqual(["id-5", "id-4", "id-3"]);
  });

  it("d) listHistory respeta el orden startedAt descendente", async () => {
    await saveHistory(entry("id-a", 10));
    await saveHistory(entry("id-b", 30));
    await saveHistory(entry("id-c", 20));

    const rows = await listHistory(10);
    expect(rows.map((row) => row.requestId)).toEqual(["id-b", "id-c", "id-a"]);
  });

  it("e) toHistoryEntry redacta headers sensibles sin tocar el input original", () => {
    const input = {
      method: "POST",
      url: "https://api.test/pay",
      headers: {
        Authorization: "Bearer super-secret",
        Cookie: "session=abc",
        "Set-Cookie": "session=abc",
        "Proxy-Authorization": "Basic dXNlcjpwYXNz",
        "x-api-key": "key-123",
        "Content-Type": "application/json",
        "X-Request-ID": "req-1",
      },
      requestId: "req-1",
    };

    const result = toHistoryEntry(input, {
      requestId: "req-1",
      status: 200,
      statusText: "OK",
      responseHeaders: {},
      bodyText: "ok",
      bodyTruncated: false,
      bytesRead: 2,
      durationMs: 5,
    });

    expect(result.requestHeaders).toEqual({
      Authorization: "[redacted]",
      Cookie: "[redacted]",
      "Set-Cookie": "[redacted]",
      "Proxy-Authorization": "[redacted]",
      "x-api-key": "[redacted]",
      "Content-Type": "application/json",
      "X-Request-ID": "req-1",
    });
    // El objeto original NO se muta (el request que se envía conserva el valor real).
    expect(input.headers.Authorization).toBe("Bearer super-secret");
  });

  it("f) redactHeaders devuelve undefined si headers es undefined", () => {
    expect(redactHeaders(undefined)).toBeUndefined();
  });
});
