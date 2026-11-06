/* Ciclo de vida del proceso hijo: puerto del backend queda libre tras
   cerrarse Estela (Ctrl+C → dispose → taskkill /T /F en Windows). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { spawnProcess } from "./process-runner.js";

const CHILD_ECHO_SCRIPT = String.raw`
const http = require("node:http");
const server = http.createServer(() => {});
server.listen(0, "127.0.0.1", () => console.log("PORT:" + server.address().port));
console.log("\x1B[31mERROR rojo\x1B[0m arranque ✓");
console.error("advertencia utf-8 éé");
`;

const CHILD_EXIT_SCRIPT = `process.exitCode = Number(process.argv.at(-1));`;

function connectToPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("error", reject);
  });
}

describe("spawnProcess", () => {
  let tempRoot: string;
  beforeAll(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "estela-proc-"));
  });
  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("captura stdout/stderr con hora del CLI, ANSI eliminado y utf-8 intacto", async () => {
    const script = join(tempRoot, "child-echo.cjs");
    writeFileSync(script, CHILD_ECHO_SCRIPT, "utf8");
    // execPath completo: ruta con espacios ("C:\Program Files\...") pasa por
    // shell en Windows → exige entrecomillado correcto (bug real del e2e).
    const run = spawnProcess([process.execPath, script]);
    try {
      // Espera a que el hijo imprima el puerto y las líneas de prueba.
      let serverPort = 0;
      for (let i = 0; i < 100 && serverPort === 0; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        const snapshot = run.buffer.readFrom(0);
        if (snapshot.lines.some((line) => line.text.startsWith("PORT:"))) {
          serverPort = Number(snapshot.lines.filter((line) => line.text.startsWith("PORT:"))[0]?.text.split("PORT:")[1]);
        }
      }
      expect(serverPort).toBeGreaterThan(0);
      const snapshot = run.buffer.readFrom(0);
      const texts = snapshot.lines.map((line) => `${line.stream}:${line.text}`);
      expect(texts.some((text) => text.includes("stdout:ERROR rojo arranque ✓"))).toBe(true);
      expect(texts.some((text) => text.includes("stderr:advertencia utf-8 éé"))).toBe(true);
      expect(texts.some((text) => text.includes("\x1B[31m"))).toBe(false);
      // Todas las líneas tienen hora del CLI (epoch ms).
      expect(snapshot.lines.every((line) => Number.isFinite(line.t) && line.t > 0)).toBe(true);
      // El hijo sigue vivo: el puerto responde.
      await expect(connectToPort(serverPort)).resolves.toBeUndefined();
      run.dispose();
    } finally {
      run.dispose();
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    }
  });

  it("exited con el código de salida del hijo", async () => {
    const script = join(tempRoot, "child-exit.cjs");
    writeFileSync(script, CHILD_EXIT_SCRIPT, "utf8");
    const run = spawnProcess(["node", script, "3"]);
    try {
      for (let i = 0; i < 50 && !run.buffer.hasExited; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      const snapshot = run.buffer.readFrom(0);
      expect(snapshot.exited).toEqual({ code: 3 });
      expect(snapshot.lines).toEqual([]);
    } finally {
      run.dispose();
    }
  });

  it("después de cerrar Estela el puerto del hijo queda libre (Windows: taskkill /T /F)", async () => {
    const script = join(tempRoot, "child-port.cjs");
    writeFileSync(script, CHILD_ECHO_SCRIPT, "utf8");
    const run = spawnProcess(["node", script]);
    let serverPort = 0;
    for (let i = 0; i < 100 && serverPort === 0; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const snapshot = run.buffer.readFrom(0);
      serverPort = Number(
        snapshot.lines.find((line) => line.text.startsWith("PORT:"))?.text.slice("PORT:".length) ?? 0,
      );
    }
    expect(serverPort).toBeGreaterThan(0);
    await expect(connectToPort(serverPort)).resolves.toBeUndefined();

    run.dispose();
    // El árbol se muere: conexión rechazada.
    let freed = false;
    for (let i = 0; i < 40 && !freed; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      freed = await connectToPort(serverPort).then(
        () => false,
        () => true,
      );
    }
    expect(freed, "el backend del hijo sigue ocupando el puerto").toBe(true);
  });
});
