import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLogSource } from "./mock-log-source.js";

describe("MockLogSource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("emite líneas con los requestIds del provider (70%, forzado con Math.random)", async () => {
    const source = new MockLogSource("mock", "mock", { requestIdProvider: () => ["req-42"] });
    const raws: string[] = [];
    source.subscribe((lines) => {
      raws.push(...lines.map((line) => line.raw));
    });

    await source.start();
    vi.advanceTimersByTime(300);
    await source.stop();

    expect(raws.length).toBeGreaterThan(0);
    expect(raws.every((raw) => raw.includes("req-42"))).toBe(true);
  });

  it("funciona sin provider (primera visita sin requests registrados)", async () => {
    const source = new MockLogSource();
    const raws: string[] = [];
    source.subscribe((lines) => {
      raws.push(...lines.map((line) => line.raw));
    });

    await source.start();
    vi.advanceTimersByTime(300);
    await source.stop();

    expect(raws.length).toBeGreaterThan(0);
  });

  it("si el provider devuelve [], no falla y emite líneas normales", async () => {
    const source = new MockLogSource("mock", "mock", { requestIdProvider: () => [] });
    const raws: string[] = [];
    source.subscribe((lines) => {
      raws.push(...lines.map((line) => line.raw));
    });

    await source.start();
    vi.advanceTimersByTime(300);
    await source.stop();

    expect(raws.length).toBeGreaterThan(0);
    expect(raws.every((raw) => !raw.includes("req-"))).toBe(true);
  });

  it("si el provider lanza, no falla y emite líneas normales", async () => {
    const source = new MockLogSource("mock", "mock", {
      requestIdProvider: () => {
        throw new Error("store no listo");
      },
    });
    const raws: string[] = [];
    source.subscribe((lines) => {
      raws.push(...lines.map((line) => line.raw));
    });

    await source.start();
    vi.advanceTimersByTime(300);
    await source.stop();

    expect(raws.length).toBeGreaterThan(0);
  });
});
