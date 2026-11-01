import { describe, expect, it } from "vitest";
import { pluralProbableLines, pluralSecureLines, pluralTrailErrors, pluralTrailWarns } from "./trail-counts";

describe("plurales de la barra del rastro", () => {
  it("líneas seguras: 1 línea segura / N líneas seguras", () => {
    expect(pluralSecureLines(0)).toBe("0 líneas seguras");
    expect(pluralSecureLines(1)).toBe("1 línea segura");
    expect(pluralSecureLines(2)).toBe("2 líneas seguras");
    expect(pluralSecureLines(17)).toBe("17 líneas seguras");
  });

  it("probables: 0 probables / 1 probable / N probables", () => {
    expect(pluralProbableLines(0)).toBe("0 probables");
    expect(pluralProbableLines(1)).toBe("1 probable");
    expect(pluralProbableLines(2)).toBe("2 probables");
  });

  it("errores: sin errores / 1 error / N errores", () => {
    expect(pluralTrailErrors(0)).toBe("sin errores");
    expect(pluralTrailErrors(1)).toBe("1 error");
    expect(pluralTrailErrors(3)).toBe("3 errores");
  });

  it("avisos: 0 avisos / 1 aviso / N avisos", () => {
    expect(pluralTrailWarns(0)).toBe("0 avisos");
    expect(pluralTrailWarns(1)).toBe("1 aviso");
    expect(pluralTrailWarns(2)).toBe("2 avisos");
  });
});
