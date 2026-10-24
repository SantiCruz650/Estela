import { describe, expect, it } from "vitest";
import { demoResponseFor, respondDemo } from "./demo";

const ID = "8f3a1111-2222-4333-8444-555566667777";

describe("demoResponseFor (rutas del responder demo)", () => {
  it("GET /api/users → 200 con lista de 2 usuarios", () => {
    const res = demoResponseFor("GET", "http://localhost:3000/api/users", ID);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.bodyText);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(res.delayMs).toBeGreaterThanOrEqual(6);
    expect(res.delayMs).toBeLessThanOrEqual(900);
  });

  it("POST /api/orders → 201", () => {
    const res = demoResponseFor("POST", "http://localhost:3000/api/orders", ID);
    expect(res.status).toBe(201);
    expect(JSON.parse(res.bodyText).status).toBe("created");
  });

  it("GET /api/orders/918 → 500 con requestId en el body", () => {
    const res = demoResponseFor("GET", "http://localhost:3000/api/orders/918", ID);
    expect(res.status).toBe(500);
    const body: unknown = JSON.parse(res.bodyText);
    expect(body).toHaveProperty("requestId", ID);
  });

  it("DELETE /api/session → 204 sin body", () => {
    const res = demoResponseFor("DELETE", "http://localhost:3000/api/session", ID);
    expect(res.status).toBe(204);
    expect(res.bodyText).toBe("");
  });

  it("otra ruta → 404", () => {
    expect(demoResponseFor("GET", "http://localhost:3000/api/nope", ID).status).toBe(404);
    expect(demoResponseFor("PUT", "http://localhost:3000/api/users", ID).status).toBe(404);
  });
});

describe("respondDemo", () => {
  it("respeta la latencia pasada por el sleep inyectado", async () => {
    const sleeps: number[] = [];
    const res = await respondDemo(
      {
        method: "GET",
        url: "http://localhost:3000/api/users",
        headers: {},
        requestId: ID,
      },
      async (ms) => {
        sleeps.push(ms);
      },
    );
    expect(sleeps[0]).toBeGreaterThanOrEqual(6);
    expect(res.durationMs).toBe(sleeps[0]);
    expect(res.status).toBe(200);
  });

  it("las latencias caen en el rango realista 6-900 ms", () => {
    for (const [method, url] of [["GET", "/api/users"], ["POST", "/api/orders"], ["DELETE", "/api/session"], ["GET", "/api/zzz"]] as const) {
      const res = demoResponseFor(method, `http://localhost:3000${url}`, ID);
      expect(res.delayMs).toBeGreaterThanOrEqual(6);
      expect(res.delayMs).toBeLessThanOrEqual(900);
    }
  });
});
