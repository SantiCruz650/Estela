import { beforeEach, describe, expect, it } from "vitest";
import { respondDemo, demoResponseFor } from "./demo";
import { runDemoSequence } from "./demo-run";
import { useCorrelationStore } from "./correlation-store";
import { useResponseStore } from "./response-store";
import { newRequestId } from "./request-id";

beforeEach(() => {
  useCorrelationStore.setState({
    requests: [],
    selectedRequestId: null,
    trailColors: {},
    buffer: [],
  });
  useResponseStore.setState({ response: null, input: null, selection: null });
});

describe("runDemoSequence", () => {
  it("arranca 4 requests demo espaciados y deja seleccionado el 918", async () => {
    const sleeps: number[] = [];
    await runDemoSequence({
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const requests = useCorrelationStore.getState().requests;
    expect(requests).toHaveLength(4);
    const slugs = new Set(requests.map((r) => r.url));
    expect(slugs.has("http://localhost:3000/api/users")).toBe(true);
    expect(slugs.has("http://localhost:3000/api/orders")).toBe(true);
    expect(slugs.has("http://localhost:3000/api/orders/918")).toBe(true);
    expect(slugs.has("http://localhost:3000/api/session")).toBe(true);
    // el seleccionado es el 918
    expect(useCorrelationStore.getState().selectedRequestId).toBe(
      requests.find((r) => r.url === "http://localhost:3000/api/orders/918")?.requestId,
    );
    // la respuesta mostrada es la del 918
    expect(useResponseStore.getState().response?.status).toBe(500);
  });

  it("no repite la secuencia si ya hay requests demo", async () => {
    await runDemoSequence();
    await runDemoSequence();
    expect(useCorrelationStore.getState().requests).toHaveLength(4);
  });
});

describe("respondDemo + recordRequest vía responder", () => {
  it("el 500 lleva el requestId en el body y duración 849", async () => {
    const res = await respondDemo(
      { method: "GET", url: "http://localhost:3000/api/orders/918", headers: {}, requestId: newRequestId() },
      async () => {
        // latencia instantánea en test
      },
    );
    expect(res.durationMs).toBe(849);
    expect(JSON.parse(res.bodyText).requestId).toBe(res.requestId);
    expect(demoResponseFor("GET", "http://localhost:3000/api/orders/918", res.requestId)
      .delayMs).toBe(849);
  });
});
