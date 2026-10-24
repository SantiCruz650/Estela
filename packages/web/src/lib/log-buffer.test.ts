import { describe, beforeEach, expect, it } from "vitest";
import { parseLine } from "@devtool/core";
import { useLogLineStore } from "./log-buffer";

function line(raw: string): ReturnType<typeof parseLine> {
  return parseLine(`[2026-10-24T10:00:00Z] INFO ${raw}`, "test.log");
}

beforeEach(() => {
  useLogLineStore.setState({ lines: [], pending: [], paused: false, sourceRunning: false });
});

describe("log buffer con pausa", () => {
  it("acumula en lines cuando no está pausado", () => {
    useLogLineStore.getState().appendLines([line("uno")]);
    expect(useLogLineStore.getState()).toHaveProperty("lines");
    expect(useLogLineStore.getState().lines).toHaveLength(1);
  });

  it("en pausa guarda en pending y la vista no cambia", () => {
    useLogLineStore.getState().appendLines([line("antes")]);
    useLogLineStore.getState().setPaused(true);
    useLogLineStore.getState().appendLines([line("durante-1")]);
    useLogLineStore.getState().appendLines([line("durante-2")]);
    const state = useLogLineStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.pending).toHaveLength(2);
    expect(state.pending.map((l) => l.raw)).toEqual([
      "[2026-10-24T10:00:00Z] INFO durante-1",
      "[2026-10-24T10:00:00Z] INFO durante-2",
    ]);
  });

  it("resume vuelca pending en lines y limpia", () => {
    useLogLineStore.getState().appendLines([line("a")]);
    useLogLineStore.getState().setPaused(true);
    useLogLineStore.getState().appendLines([line("b")]);
    useLogLineStore.getState().resume();
    expect(useLogLineStore.getState().paused).toBe(false);
    expect(useLogLineStore.getState().lines).toHaveLength(2);
    expect(useLogLineStore.getState().pending).toHaveLength(0);
  });

  it("respeta el límite circular de líneas", () => {
    const many = Array.from({ length: 2500 }, (_, i) => line(`l-${i}`));
    useLogLineStore.getState().appendLines(many);
    expect(useLogLineStore.getState().lines).toHaveLength(2000);
    expect(useLogLineStore.getState().lines[0]?.raw).toContain("l-500");
  });
});
