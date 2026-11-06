import { describe, expect, it } from "vitest";
import { pluralProbableLines, pluralSecureLines, trailIssuesPhrase } from "./trail-counts";

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

  it("frase de problemas: cero de ambos se nombra por lo que NO pasó", () => {
    expect(trailIssuesPhrase(0, 0)).toBe("sin errores ni avisos");
  });

  it("frase de problemas: solo errores (sin avisos)", () => {
    expect(trailIssuesPhrase(1, 0)).toBe("1 error · sin avisos");
    expect(trailIssuesPhrase(3, 0)).toBe("3 errores · sin avisos");
  });

  it("frase de problemas: solo avisos (sin errores)", () => {
    expect(trailIssuesPhrase(0, 1)).toBe("sin errores · 1 aviso");
    expect(trailIssuesPhrase(0, 2)).toBe("sin errores · 2 avisos");
  });

  it("frase de problemas: ambos, con los plurales normales", () => {
    expect(trailIssuesPhrase(1, 2)).toBe("1 error · 2 avisos");
    expect(trailIssuesPhrase(3, 1)).toBe("3 errores · 1 aviso");
  });

  it("la frase jamás contiene '0 errores' ni '0 avisos'", () => {
    for (const errors of [0, 1, 3]) {
      for (const warns of [0, 1, 2]) {
        const phrase = trailIssuesPhrase(errors, warns);
        expect(phrase).not.toContain("0 errores");
        expect(phrase).not.toContain("0 avisos");
      }
    }
  });
});
