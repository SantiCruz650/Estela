import { describe, expect, it } from "vitest";
import { parseLine } from "@devtool/core";
import { type LogFilter, countByLevel, filterLines, matchesFilter } from "./log-filter";

const ID = "8f3a1111-2222-4333-8444-555566667777";

function line(raw: string, levelOverride?: "unknown"): ReturnType<typeof parseLine> {
  const parsed = parseLine(raw, "test.log");
  if (levelOverride === undefined && parsed.level === "unknown") {
    // las líneas de test siempre declaran nivel explícito salvo override vacío
    throw new Error(`${raw} no declara nivel`);
  }
  return parsed;
}

describe("matchesFilter", () => {
  const base: LogFilter = { level: "all", query: "" };

  it("filtra por nivel", () => {
    const warn = line(`[2026-10-24T10:00:00Z] WARN query lenta detectada`);
    const info = line(`[2026-10-24T10:00:01Z] INFO ready on :3000`);
    expect(matchesFilter(warn, { ...base, level: "warn" })).toBe(true);
    expect(matchesFilter(warn, { ...base, level: "info" })).toBe(false);
    expect(matchesFilter(info, { ...base, level: "all" })).toBe(true);
  });

  it("busca en el mensaje y en el id", () => {
    const withId = line(`[2026-10-24T10:00:00Z] INFO handled req=${ID}`);
    const noId = line(`[2026-10-24T10:00:01Z] DEBUG pool stats active=3 idle=7`);
    expect(matchesFilter(withId, { ...base, query: "handled" })).toBe(true);
    expect(matchesFilter(withId, { ...base, query: "8f3a1111" })).toBe(true);
    expect(matchesFilter(noId, { ...base, query: "pool" })).toBe(true);
    expect(matchesFilter(noId, { ...base, query: "nope" })).toBe(false);
  });

  it("no explota con nivel unknown", () => {
    const unknown = parseLine("texto sin nivel ni uuid", "x.log");
    expect(matchesFilter(unknown, base)).toBe(true);
    expect(matchesFilter(unknown, { ...base, level: "info" })).toBe(false);
  });
});

describe("filterLines", () => {
  it("filtra la lista completa sin reordenar", () => {
    const a = line(`[2026-10-24T10:00:00Z] INFO ready on :3000`);
    const b = line(`[2026-10-24T10:00:01Z] WARN query lenta detectada`);
    const c = line(`[2026-10-24T10:00:02Z] DEBUG cache warm-up`);
    const out = filterLines([a, b, c], { level: "info", query: "" });
    expect(out).toEqual([a]);
  });
});

describe("countByLevel", () => {
  it("cuenta por nivel y el total", () => {
    const lines = [
      line(`[2026-10-24T10:00:00Z] INFO uno`),
      line(`[2026-10-24T10:00:01Z] INFO dos`),
      line(`[2026-10-24T10:00:02Z] WARN tres`),
      line(`[2026-10-24T10:00:03Z] ERROR cuatro`),
      line(`[2026-10-24T10:00:04Z] DEBUG cinco`),
    ];
    expect(countByLevel(lines)).toEqual({ all: 5, info: 2, warn: 1, error: 1, debug: 1 });
  });
});
