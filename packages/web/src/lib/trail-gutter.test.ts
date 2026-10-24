import { describe, expect, it } from "vitest";
import { trailSpan } from "./trail-gutter";

describe("trailSpan", () => {
  it("devuelve la primera y última fila del rastro", () => {
    expect(trailSpan([false, true, true, false, true, false])).toEqual({ first: 1, last: 4 });
  });

  it("una sola fila del rastro une a sí misma", () => {
    expect(trailSpan([false, false, true, false])).toEqual({ first: 2, last: 2 });
  });

  it("todo el rastro", () => {
    expect(trailSpan([true, true, true])).toEqual({ first: 0, last: 2 });
  });

  it("sin filas del rastro devuelve null", () => {
    expect(trailSpan([])).toBeNull();
    expect(trailSpan([false, false])).toBeNull();
  });
});
