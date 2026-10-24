import { beforeEach, describe, expect, it } from "vitest";
import { Correlator, type RequestRecord } from "@devtool/core";
import { parseLine } from "@devtool/core";
import { useCorrelationStore } from "./correlation-store";

const request = (requestId: string, startedAt = 1): RequestRecord => ({
  requestId,
  method: "GET",
  url: "http://localhost/api/users",
  statusCode: 200,
  startedAt,
  durationMs: 10,
});

beforeEach(() => {
  useCorrelationStore.setState({
    requests: [],
    correlator: new Correlator(2),
    selectedRequestId: null,
    buffer: [],
    trailColors: {},
  });
});

describe("correlation store", () => {
  it("asigna el color de rastro cíclicamente por orden de llegada", () => {
    const store = useCorrelationStore.getState();
    store.recordRequest(request("req-a"));
    store.recordRequest(request("req-b"));
    store.recordRequest(request("req-c"));
    store.recordRequest(request("req-a", 2));

    const colors = useCorrelationStore.getState().trailColors;
    expect(colors["req-a"]).toBe(0);
    expect(colors["req-b"]).toBe(1);
    expect(colors["req-c"]).toBe(2);
    // reenvío del mismo request conserva su color
    expect(colors["req-a"]).toBe(0);
    expect(useCorrelationStore.getState().getTrailColorIndex("req-b")).toBe(1);
  });

  it("keeps recent requests first and caps them at 50", () => {
    for (let index = 0; index < 51; index += 1) {
      useCorrelationStore.getState().recordRequest(request(`id-${index}`, index));
    }

    const requests = useCorrelationStore.getState().requests;
    expect(requests).toHaveLength(50);
    expect(requests[0]?.requestId).toBe("id-50");
    expect(requests[49]?.requestId).toBe("id-1");
  });

  it("does not duplicate a repeated requestId", () => {
    useCorrelationStore.getState().recordRequest(request("same", 1));
    useCorrelationStore.getState().recordRequest(request("same", 2));

    const requests = useCorrelationStore.getState().requests;
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual(request("same", 2));
  });

  it("correlates parsed lines and includes surrounding context", () => {
    const requestId = "550e8400-e29b-41d4-a716-446655440000";
    useCorrelationStore.getState().recordRequest(request(requestId));
    useCorrelationStore.getState().ingest([
      parseLine("INFO before", "app.log"),
      parseLine(`INFO matched [req=${requestId}]`, "app.log"),
      parseLine("WARN after", "app.log"),
    ]);

    const result = useCorrelationStore.getState().getCorrelation(requestId);
    expect(result?.matchingLines.map((line) => line.raw)).toEqual([`INFO matched [req=${requestId}]`]);
    expect(result?.contextBefore.map((line) => line.raw)).toEqual(["INFO before"]);
    expect(result?.contextAfter.map((line) => line.raw)).toEqual(["WARN after"]);
  });

  it("ingest acumula el buffer completo", () => {
    useCorrelationStore.getState().ingest([parseLine("INFO first", "a.log")]);
    useCorrelationStore.getState().ingest([parseLine("WARN second", "a.log")]);
    const buffer = useCorrelationStore.getState().buffer;
    expect(buffer).toHaveLength(2);
    expect(buffer[0]?.raw).toBe("INFO first");
  });

  it("returns null for an unknown request", () => {
    expect(useCorrelationStore.getState().getCorrelation("missing")).toBeNull();
  });
});