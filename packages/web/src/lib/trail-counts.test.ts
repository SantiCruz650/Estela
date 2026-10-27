import { describe, expect, it } from "vitest";
import { pluralTrailErrors, pluralTrailLines, pluralTrailWarns } from "./trail-counts";

describe("plurales de la barra del rastro", () => {
  it("líneas: 1 línea / N líneas", () => {
    expect(pluralTrailLines(1)).toBe("1 línea");
    expect(pluralTrailLines(2)).toBe("2 líneas");
    expect(pluralTrailLines(17)).toBe("17 líneas");
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
