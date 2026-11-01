import { describe, expect, it } from "vitest";
import { Correlator, probableRequestForLine, type RequestRecord } from "./correlator.js";
import type { LogLine } from "./types.js";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const contextRequestId = "123e4567-e89b-42d3-a456-426614174000";

function request(requestIdToUse = requestId): RequestRecord {
  return {
    requestId: requestIdToUse,
    method: "GET",
    url: "/api/users",
    statusCode: null,
    startedAt: 1000,
    durationMs: null,
  };
}

function line(raw: string, requestIds: string[] = []): LogLine {
  return {
    id: raw,
    raw,
    timestamp: null,
    level: "info",
    requestIds,
    filePath: "app.log",
  };
}

describe("Correlator", () => {
  it("inserts a request", () => {
    const correlator = new Correlator();
    correlator.upsertRequest(request());
    correlator.ingestLines([line("match", [requestId])]);

    expect(correlator.correlate(requestId)?.request).toEqual(request());
  });

  it("upserts a request idempotently", () => {
    const correlator = new Correlator();
    const updated = { ...request(), statusCode: 200 };
    correlator.upsertRequest(request());
    correlator.upsertRequest(updated);
    correlator.ingestLines([line("match", [requestId])]);

    expect(correlator.correlate(requestId)?.request).toEqual(updated);
  });

  it("correlates one matching line", () => {
    const correlator = new Correlator();
    correlator.upsertRequest(request());
    const match = line("match", [requestId]);
    correlator.ingestLines([match]);

    expect(correlator.correlate(requestId)?.matchingLines).toEqual([match]);
  });

  it("returns all matching lines", () => {
    const correlator = new Correlator();
    correlator.upsertRequest(request());
    const matches = [line("first", [requestId]), line("middle"), line("last", [requestId])];
    correlator.ingestLines(matches);

    expect(correlator.correlate(requestId)?.matchingLines).toEqual([matches[0], matches[2]]);
  });

  it("returns null without matches", () => {
    const correlator = new Correlator();
    correlator.upsertRequest(request());
    correlator.ingestLines([line("other")]);

    expect(correlator.correlate(requestId)).toBeNull();
  });

  it("limits context before a match at the buffer edge", () => {
    const correlator = new Correlator(3);
    correlator.upsertRequest(request());
    const lines = [line("before-1"), line("before-2"), line("match", [requestId])];
    correlator.ingestLines(lines);

    expect(correlator.correlate(requestId)?.contextBefore).toEqual([lines[0], lines[1]]);
  });

  it("limits context after a match at the buffer edge", () => {
    const correlator = new Correlator(3);
    correlator.upsertRequest(request());
    const lines = [line("match", [requestId]), line("after-1"), line("after-2")];
    correlator.ingestLines(lines);

    expect(correlator.correlate(requestId)?.contextAfter).toEqual([lines[1], lines[2]]);
  });

  it("uses context from both sides of multiple matches", () => {
    const correlator = new Correlator(1);
    correlator.upsertRequest(request());
    const lines = [line("before"), line("first", [requestId]), line("between"), line("last", [requestId]), line("after")];
    correlator.ingestLines(lines);

    expect(correlator.correlate(requestId)).toEqual({
      request: request(),
      matchingLines: [lines[1], lines[3]],
      contextBefore: [lines[0]],
      contextAfter: [lines[4]],
    });
  });

  it("evicts the oldest lines after exceeding the ring limit", () => {
    const correlator = new Correlator(3, 5000);
    correlator.upsertRequest(request());
    const oldLine = line("old", [requestId]);
    correlator.ingestLines([oldLine, ...Array.from({ length: 5099 }, (_, index) => line(`line-${index}`))]);

    expect(correlator.correlate(requestId)).toBeNull();
  });

  it("keeps the newest lines after ring buffer eviction", () => {
    const correlator = new Correlator(3, 2);
    correlator.upsertRequest(request());
    const newest = line("newest", [requestId]);
    correlator.ingestLines([line("oldest"), line("middle"), newest]);

    expect(correlator.correlate(requestId)?.matchingLines).toEqual([newest]);
  });

  it("matches raw lines whose text contains the exact request id (any format)", () => {
    const correlator = new Correlator(2);
    correlator.upsertRequest(request(contextRequestId));
    const mention = line(`context mentions ${contextRequestId}`);
    correlator.ingestLines([mention, line("match", [requestId])]);

    // Antes devolvía null (solo miraba requestIds extraídos por regex).
    // Ahora el raw que contiene el id exacto también correlaciona.
    expect(correlator.correlate(contextRequestId)?.matchingLines).toEqual([mention]);
  });

  it("matches non-UUID request ids embedded in raw text", () => {
    const correlator = new Correlator(2);
    correlator.upsertRequest(request("req-abc-42"));
    const mention = line("POST /pay id=req-abc-42 ok");
    correlator.ingestLines([mention]);

    expect(correlator.correlate("req-abc-42")?.matchingLines).toEqual([mention]);
  });

  it("does not correlate unknown ids", () => {
    const correlator = new Correlator(2);
    correlator.upsertRequest(request());
    correlator.ingestLines([line("processed req-10 batch")]);

    expect(correlator.correlate("never-registered")).toBeNull();
  });
});

describe("probableRequestForLine (correlación probable por tiempo)", () => {
  // Request A: corre de 1000 a 1100 (100 ms). Ventana +50 ms → [1000, 1150].
  const reqA: RequestRecord = {
    requestId: "req-a",
    method: "GET",
    url: "/api/a",
    statusCode: 200,
    startedAt: 1000,
    durationMs: 100,
  };
  // Request B: corre de 1300 a 1350 (50 ms). Ventana +50 ms → [1300, 1400].
  const reqB: RequestRecord = {
    requestId: "req-b",
    method: "POST",
    url: "/api/b",
    statusCode: 200,
    startedAt: 1300,
    durationMs: 50,
  };

  /** línea con timestamp parseable o null. */
  function timeLine(raw: string, timestamp: string | null): LogLine {
    return { id: raw, raw, timestamp, level: "info", requestIds: [], filePath: "app.log" };
  }

  it("asigna probable cuando el timestamp cae dentro de [inicio, fin + 50 ms]", () => {
    expect(probableRequestForLine(timeLine("INFO creando usuario", new Date(1100).toISOString()), [reqA], 0)).toBe("req-a");
    // Borde superior: fin + 50 exacto cuenta.
    expect(probableRequestForLine(timeLine("x", new Date(1150).toISOString()), [reqA], 0)).toBe("req-a");
    // Un ms después: fuera.
    expect(probableRequestForLine(timeLine("x", new Date(1151).toISOString()), [reqA], 0)).toBeNull();
    // Un ms antes del inicio: fuera.
    expect(probableRequestForLine(timeLine("x", new Date(999).toISOString()), [reqA], 0)).toBeNull();
  });

  it("no asigna si el timestamp cae en la ventana de varios requests", () => {
    const reqC: RequestRecord = { ...reqA, requestId: "req-c", durationMs: 200 };
    const reqD: RequestRecord = { ...reqB, requestId: "req-d", startedAt: 1100, durationMs: 200 };
    const l = timeLine("INFO shared moment", new Date(1150).toISOString());
    expect(probableRequestForLine(l, [reqC, reqD], 0)).toBeNull();
  });

  it("lo seguro gana: una línea con el id exacto no es probable", () => {
    const secure = timeLine("POST /b id=req-b 200", new Date(2000).toISOString());
    // Caería en ninguna ventana de req-a, pero aunque cayese en otra, no es probable.
    expect(probableRequestForLine(secure, [reqA, reqB], 0)).toBeNull();

    const secureInOtherWindow = timeLine("req-a inicializado", new Date(1400).toISOString());
    expect(probableRequestForLine(secureInOtherWindow, [reqA, reqB], 0)).toBeNull();
  });

  it("no asigna si la línea ya pertenece (requestIds) a otro request conocido", () => {
    const l: LogLine = {
      id: "l",
      raw: "WARN orden duplicada",
      timestamp: new Date(1100).toISOString(),
      level: "warn",
      requestIds: ["req-b"],
      filePath: "app.log",
    };
    expect(probableRequestForLine(l, [reqA, reqB], 0)).toBeNull();
  });

  it("sin timestamp usa la hora de llegada con ventana [inicio, fin + 400 ms]", () => {
    const noTs = timeLine("INFO sin timestamp", null);
    expect(probableRequestForLine(noTs, [reqA], 1300)).toBe("req-a"); // 1100+200 <= 1500
    expect(probableRequestForLine(noTs, [reqA], 1500)).toBe("req-a"); // borde fin+400
    expect(probableRequestForLine(noTs, [reqA], 1501)).toBeNull();    // fuera
  });

  it("una línea CON timestamp no usa la ventana amplia de llegada", () => {
    const withTs = timeLine("INFO tardío", new Date(1300).toISOString());
    // Con timestamp solo aplica [inicio, fin+50] = [1000, 1150]: 1300 está fuera.
    expect(probableRequestForLine(withTs, [reqA], 1100)).toBeNull();
  });

  it("ignora timestamps parseables de otros días (fuera de cualquier ventana)", () => {
    expect(probableRequestForLine(timeLine("INFO viejo", new Date(5_000_000_000).toISOString()), [reqA], 1100)).toBeNull();
  });

  it("request sin duración (en curso) mantiene la ventana abierta hasta conocerla", () => {
    const running: RequestRecord = { ...reqA, durationMs: null };
    const l = timeLine("INFO durante el vuelo", new Date(5000).toISOString());
    expect(probableRequestForLine(l, [running], 0)).toBe("req-a");
  });
});
