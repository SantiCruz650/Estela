import { describe, expect, it } from "vitest";
import { TRAIL_PALETTE, hexToRgba, trailColor, trailTint } from "./trail-colors";

describe("trail-colors", () => {
  it("asigna colores cíclicos por orden", () => {
    expect(trailColor(0)).toBe("#22D3EE");
    expect(trailColor(5)).toBe("#7DB4FF");
    expect(trailColor(6)).toBe("#22D3EE");
    expect(trailColor(-1)).toBe("#7DB4FF");
  });

  it("la paleta tiene 6 colores y los tintes llevan alfa", () => {
    expect(TRAIL_PALETTE).toHaveLength(6);
    expect(trailTint(0)).toMatch(/^rgba\(34,211,238,0\.1\)$/);
    expect(trailTint(2, 0.55)).toMatch(/^rgba\(251,113,133,0\.55\)$/);
  });

  it("hexToRgba lanza con hex inválido", () => {
    expect(() => hexToRgba("zzz", 0.5)).toThrow();
  });
});
