/* Buffer circular de la salida del hijo (en memoria, sin disco):
   máx. 20 000 líneas y máx. 5 MB acumulados; lectura incremental por cursor
   para el endpoint GET /api/process. */
import { describe, expect, it } from "vitest";
import { ProcessLogBuffer, PROCESS_BUFFER_MAX_LINES } from "./process-buffer.js";

describe("ProcessLogBuffer", () => {
  it("readFrom(cursor) devuelve lo nuevo y el cursor avanza", () => {
    const buffer = new ProcessLogBuffer();
    buffer.append(1000, "a", "stdout");
    buffer.append(1001, "b", "stdout");
    const first = buffer.readFrom(0);
    expect(first.cursor).toBe(2);
    expect(first.lines).toEqual([
      { t: 1000, text: "a", stream: "stdout" },
      { t: 1001, text: "b", stream: "stdout" },
    ]);
    expect(first.exited).toBeNull();

    buffer.append(1002, "c", "stderr");
    const second = buffer.readFrom(first.cursor);
    expect(second.lines).toEqual([{ t: 1002, text: "c", stream: "stderr" }]);
    expect(second.cursor).toBe(3);
  });

  it("descarta lo más viejo al superar el máximo de líneas", () => {
    const buffer = new ProcessLogBuffer();
    for (let i = 0; i <= PROCESS_BUFFER_MAX_LINES; i++) {
      buffer.append(i, `linea-${i}`, "stdout");
    }
    const snapshot = buffer.readFrom(0);
    expect(snapshot.lines).toHaveLength(PROCESS_BUFFER_MAX_LINES);
    // Con trimming, los cursores siguen siendo monotónicos: la línea 0 (la más
    // vieja) ya no existe, así que readFrom(0) devuelve desde la más vieja retenida.
    expect(snapshot.lines[0]?.text).toBe("linea-1");
    expect(snapshot.lines[snapshot.lines.length - 1]?.text).toBe(`linea-20000`);
  });

  it("cursor lejano (más allá de lo vivo) no crashea: vuelve al inicio retenido", () => {
    const buffer = new ProcessLogBuffer();
    for (let i = 0; i < 25000; i++) {
      buffer.append(i, `L${i}`, "stdout");
    }
    const snapshot = buffer.readFrom(3);
    expect(snapshot.lines[0]?.text.startsWith("L")).toBe(true);
  });

  it("límite de bytes (5 MB): olvida las más viejas aunque no llegue al tope de líneas", () => {
    const buffer = new ProcessLogBuffer();
    // 3 KB por línea * 3000 = ~9 MB > 5 MB
    for (let i = 0; i < 3000; i++) {
      buffer.append(i, "x".repeat(3000), "stdout");
    }
    const snapshot = buffer.readFrom(0);
    expect(snapshot.lines.length).toBeLessThan(3000);
    expect(snapshot.lines[0]?.text.length).toBeLessThan(4000);
  });

  it("exited: la salida del hijo queda visible para nuevas lecturas", () => {
    const buffer = new ProcessLogBuffer();
    buffer.append(1, "listo", "stdout");
    buffer.setExited(0);
    const after = buffer.readFrom(0);
    expect(after.exited).toEqual({ code: 0 });
  });
});
