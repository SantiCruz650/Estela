import { describe, expect, it } from "vitest";
import { Correlator, type RequestRecord } from "./correlator.js";
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
