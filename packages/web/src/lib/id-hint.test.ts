import { beforeEach, describe, expect, it } from "vitest";
import { parseLine } from "@devtool/core";
import { shouldShowIdHint } from "./id-hint";
import type { LogLine } from "@devtool/core";

const reqA = "req-a";
const reqB = "req-b";

const request = (requestId: string) => ({ requestId });

/** líneas sin ningún id (como cuando el log no incluye el request id). */
function plainLines(): LogLine[] {
  return [parseLine("[2026-01-01T00:00:01.050Z] INFO creando usuario", "app.log")];
}

beforeEach(() => {});

describe("shouldShowIdHint (aviso para conectar el backend)", () => {
  it("no aplica con fuente demo (sin logs reales)", () => {
    expect(shouldShowIdHint("demo", [request(reqA), request(reqB)], plainLines())).toBe(false);
  });

  it("no aplica con menos de 2 requests enviadas", () => {
    expect(shouldShowIdHint("remote", [request(reqA)], plainLines())).toBe(false);
  });

  it("aplica con 2+ requests, fuente remota y ninguna línea segura", () => {
    expect(shouldShowIdHint("remote", [request(reqA), request(reqB)], plainLines())).toBe(true);
    expect(shouldShowIdHint("file", [request(reqA), request(reqB)], plainLines())).toBe(true);
  });

  it("no aplica si alguna línea menciona el id exacto de algún request (segura)", () => {
    const secure = parseLine(`[2026-01-01T00:00:01.060Z] INFO id=${reqA} listo`, "app.log");
    expect(shouldShowIdHint("remote", [request(reqA), request(reqB)], [...plainLines(), secure])).toBe(false);
  });

  it("no aplica si alguna línea trae el id en requestIds (parseado)", () => {
    const secure = parseLine(`WARN duplicada ${reqB}`, "app.log");
    expect(shouldShowIdHint("remote", [request(reqA), request(reqB)], [...plainLines(), secure])).toBe(false);
  });

  it("no aplica con 0 líneas recibidas (el log todavía no trajo nada)", () => {
    // Bug 0.1.1: con el poll sin datos el buffer está vacío y el aviso salía igual.
    expect(shouldShowIdHint("remote", [request(reqA), request(reqB)], [])).toBe(false);
    expect(shouldShowIdHint("file", [request(reqA), request(reqB)], [])).toBe(false);
  });

  it("sí aplica si las líneas existen pero pertenecen a otro request ajeno", () => {
    const other = parseLine("[2026-01-01T00:00:01.050Z] INFO id=req-desconocido listo", "app.log");
    expect(shouldShowIdHint("remote", [request(reqA), request(reqB)], [...plainLines(), other])).toBe(true);
  });
});
