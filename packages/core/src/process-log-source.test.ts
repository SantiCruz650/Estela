/* Fuente web del modo proceso: hace polling a GET /api/process?cursor=N,
   parsea cada texto con el parser central y entrega además la hora exacta
   (t) del CLI para la correlación probable (sin latencia del polling). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessLogSource } from "./process-log-source.js";

function snapshotOf(
  lines: Array<[number, string, "stdout" | "stderr"]>,
  cursor: number,
  exited: null | { code: number },
) {
  return {
    cursor,
    exited,
    lines: lines.map(([t, text, stream]) => ({ t, text, stream })),
  };
}

describe("ProcessLogSource", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("poll inicial desde cursor 0 emite todas las líneas con su hora del CLI", async () => {
    const batches: unknown[] = [];
    const source = new ProcessLogSource(
      async () => snapshotOf([[1712345678, "→ GET /api/me", "stdout"]], 1, null),
      { pollIntervalMs: 300 },
    );
    source.subscribe((batch) => batches.push(batch));
    await source.start();
    // Espera el primer tick del intervalo.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    await source.stop();
    expect(batches).toEqual([
      { lines: [expect.objectContaining({ raw: "→ GET /api/me" })], arrivalEpochs: [1712345678], exitedNow: null },
    ]);
  });

  it("los cursores avanzan y no reemite lo ya emitido", async () => {
    // El stub respeta el cursor: devuelve solo lo nuevo para ese cursor.
    const snap0 = snapshotOf([[1, "a", "stdout"]], 1, null);
    const snap1 = snapshotOf(
      [
        [2, "b", "stdout"],
        [3, "c", "stdout"],
      ],
      3,
      null,
    );
    const snapEmpty = snapshotOf([] as Array<[number, string, "stdout" | "stderr"]>, 3, null);
    const source = new ProcessLogSource(
      async (cursor) => (cursor === 0 ? snap0 : cursor === 1 ? snap1 : snapEmpty),
      { pollIntervalMs: 1 },
    );
    const collected: Array<{ arrivalEpochs: readonly number[]; lines: string[] }> = [];
    source.subscribe((batch) =>
      collected.push({
        arrivalEpochs: batch.arrivalEpochs,
        lines: batch.lines.map((line) => line.raw),
      }),
    );
    await source.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await source.stop();
    expect(collected.map((collected) => collected.lines)).toEqual([["a"], ["b", "c"]]);
  });

  it("cuando el proceso termina, exitedNow llega una única vez", async () => {
    let snap = snapshotOf([] as Array<[number, string, "stdout" | "stderr"]>, 0, null);
    const source = new ProcessLogSource(async () => snap, { pollIntervalMs: 1 });
    const exits: Array<number | null> = [];
    source.subscribe((batch) => exits.push(batch.exitedNow === null ? null : batch.exitedNow.code));
    await source.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    snap = snapshotOf([] as Array<[number, string, "stdout" | "stderr"]>, 0, { code: 1 });
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    const exitEvents = exits.filter((it) => it !== null);
    await source.stop();
    expect(exitEvents).toHaveLength(1);
    expect(exitEvents[0]).toBe(1);
  });

  it("error del poll solo avisa onError y mantiene el polling", async () => {
    let snap = snapshotOf([] as Array<[number, string, "stdout" | "stderr"]>, 0, null);
    let failing = false;
    const errors: unknown[] = [];
    const successes: number[] = [];
    const source = new ProcessLogSource(
      async () => {
        if (failing) {
          failing = false; // lanza UNA sola vez
          throw new Error("boom");
        }
        successes.push(1);
        return snap;
      },
      { pollIntervalMs: 1, onError: (error) => errors.push(error), onPollSuccess: () => undefined },
    );
    await source.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    failing = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    const before = successes.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await source.stop();
    expect(errors).toHaveLength(1);
    expect(successes.length).toBeGreaterThan(before);
  });
});
