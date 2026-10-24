import { describe, expect, it } from "vitest";
import { parseLine } from "@devtool/core";
import { buildAmbientRawLine, buildTrailRawLines, demoPath } from "./demo-trail";

const ID = "8f3a1111-2222-4333-8444-555566667777";
const TS = "2026-10-24T10:00:00.000Z";

describe("buildTrailRawLines", () => {
  it("users: flecha de entrada, SQL/caché y flecha de salida, todas con el id", () => {
    const raws = buildTrailRawLines({ requestId: ID, method: "GET", url: "http://s/api/users", status: 200, durationMs: 12, ts: TS });
    expect(raws[0]).toContain(`→ GET /api/users`);
    expect(raws.at(-1)).toContain(`← 200 GET /api/users · 12 ms`);
    expect(raws.every((r) => r.includes(`req=${ID}`))).toBe(true);
    expect(raws.some((r) => r.startsWith(`[${TS}] DEBUG SELECT`))).toBe(true);
  });

  it("orders/918 agrega WARN de query lenta y ERROR con stack", () => {
    const raws = buildTrailRawLines({ requestId: ID, method: "GET", url: "http://s/api/orders/918", status: 500, durationMs: 849, ts: TS });
    expect(raws.some((r) => r.includes("WARN") && r.includes("query lenta detectada · 849 ms"))).toBe(true);
    expect(raws.some((r) => r.includes("ERROR") && r.includes("serializeOrder (orders.ts:88)"))).toBe(true);
  });

  it("cada línea parseada lleva el id en requestIds y su nivel", () => {
    const raws = buildTrailRawLines({ requestId: ID, method: "DELETE", url: "http://s/api/session", status: 204, durationMs: 8, ts: TS });
    const parsed = raws.map((r) => parseLine(r, "demo"));
    expect(parsed.every((l) => l.requestIds.includes(ID))).toBe(true);
    expect(parsed[0].level).toBe("info");
    expect(parsed[1].level).toBe("debug");
  });
});

describe("buildAmbientRawLine", () => {
  it("healthcheck como INFO y ruido como DEBUG, sin id", () => {
    const hc = parseLine(buildAmbientRawLine(TS, "healthcheck 127.0.0.1:8000 OK"), "demo");
    expect(hc.level).toBe("info");
    expect(hc.requestIds).toHaveLength(0);
    const gc = parseLine(buildAmbientRawLine(TS, "gc minor pass"), "demo");
    expect(gc.level).toBe("debug");
  });
});

describe("demoPath", () => {
  it("extrae el path sin host", () => {
    expect(demoPath("http://localhost:3000/api/users")).toBe("/api/users");
    expect(demoPath("/api/orders")).toBe("/api/orders");
  });
});
