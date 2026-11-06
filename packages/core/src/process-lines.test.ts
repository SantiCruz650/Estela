/* Modo proceso: decodificación de la salida del hijo.
   - TextDecoder streaming: un carácter UTF-8 partido entre 2 chunks no se rompe.
   - Códigos ANSI removidos.
   - Split por líneas (\n y \r\n), última línea sin \n se emite en flush.
   Puro: funciona igual en Vitest y en el navegador. */
import { describe, expect, it } from "vitest";
import {
  createProcessLineSplitter,
  createProcessOutputHandler,
  stripAnsi,
  type ProcessLineEntry,
} from "./process-lines.js";

const encoder = new TextEncoder();

describe("stripAnsi", () => {
  it("quita códigos de color y de cursor (CSI)", () => {
    expect(stripAnsi("\x1B[34mGET /api\x1B[0m ✔ \x1B[2K\x1B[G⠋")).toBe("GET /api ✔ ⠋");
  });

  it("deja el texto plano intacto", () => {
    expect(stripAnsi("hola mundo")).toBe("hola mundo");
  });
});

describe("createProcessLineSplitter", () => {
  it("emite líneas completas y guarda el resto", () => {
    const splitter = createProcessLineSplitter();
    expect(splitter.push(encoder.encode("linea1\nlinea2\n"))).toEqual({
      lines: ["linea1", "linea2"],
      decoded: "linea1\nlinea2\n",
    });
    expect(splitter.push(encoder.encode("linea3"))).toEqual({ lines: [], decoded: "linea3" });
    expect(splitter.push(encoder.encode("\nlinea4"))).toEqual({ lines: ["linea3"], decoded: "\nlinea4" });
    expect(splitter.flush()).toEqual({ lines: ["linea4"], decoded: "linea4" });
  });

  it("carácter multibyte partido entre chunks no se rompe (UTF-8 streaming)", () => {
    const splitter = createProcessLineSplitter();
    // "→" son 3 bytes: partidos entre los dos chunks.
    const full = encoder.encode("→ GET /api/me\n");
    expect(splitter.push(full.slice(0, 1)).lines).toEqual([]);
    expect(splitter.push(full.slice(1)).lines).toEqual(["→ GET /api/me"]);
  });

  it("quita los códigos ANSI de cada línea", () => {
    const splitter = createProcessLineSplitter();
    expect(
      splitter.push(encoder.encode("\x1B[32mOK\x1B[0m \x1B[36m→\x1B[0m listos\n")).lines,
    ).toEqual(["OK → listos"]);
  });

  it("soporta fin de línea \r\n (salida de Windows)", () => {
    const splitter = createProcessLineSplitter();
    expect(splitter.push(encoder.encode("a\r\nb\n")).lines).toEqual(["a", "b"]);
  });

  it("skip de líneas vacías y flush sin línea pendiente vacía", () => {
    const splitter = createProcessLineSplitter();
    expect(splitter.push(encoder.encode("\n\n\n\n")).lines).toEqual([]);
    expect(splitter.flush()).toEqual({ lines: [], decoded: "" });
  });

  it("bytes UTF-8 inválidos se decodifican con reemplazo, sin lanzar", () => {
    const splitter = createProcessLineSplitter();
    expect(splitter.push(new Uint8Array([0xff, 0xff, 0x0a])).lines).toEqual([
      "\uFFFD\uFFFD",
    ]);
  });
});

describe("createProcessOutputHandler", () => {
  it("por stream (stdout/stderr) con hora del CLI en cada línea", () => {
    const received: ProcessLineEntry[] = [];
    const handler = createProcessOutputHandler({
      now: () => 1234,
      onLine: (entry) => received.push(entry),
    });
    handler.onData("stdout", encoder.encode("hola\n"));
    handler.onData("stderr", encoder.encode("uy\n"));
    handler.onData("stdout", encoder.encode("adios\n"));
    handler.onData("stdout", new Uint8Array(0));
    handler.onData("stdout", encoder.encode("sin newline"));
    handler.end("stdout");
    expect(received).toEqual([
      { t: 1234, text: "hola", stream: "stdout" },
      { t: 1234, text: "uy", stream: "stderr" },
      { t: 1234, text: "adios", stream: "stdout" },
      { t: 1234, text: "sin newline", stream: "stdout" },
    ]);
  });

  it("envia también el texto decodificado original (echo de terminal)", () => {
    const echoed: Array<{ stream: string; text: string }> = [];
    const handler = createProcessOutputHandler({
      now: () => 1,
      onLine: () => undefined,
      onDecoded: (stream, text) => echoed.push({ stream, text }),
    });
    handler.onData("stdout", encoder.encode("\x1B[32mvive\x1B[0m\n"));
    handler.end("stdout");
    expect(echoed).toEqual([
      { stream: "stdout", text: "\x1B[32mvive\x1B[0m\n" },
      { stream: "stdout", text: "" },
    ]);
  });
});
