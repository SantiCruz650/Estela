import { describe, expect, it } from "vitest";
import { tokenizeBody, tokenizeJson } from "./json-tokens";

describe("tokenizeJson", () => {
  it("distingue claves de strings por los dos puntos", () => {
    const tokens = tokenizeJson('{ "a": "b" }');
    expect(tokens.find((t) => t.kind === "key")?.value).toBe('"a"');
    expect(tokens.find((t) => t.kind === "string")?.value).toBe('"b"');
  });

  it("colorea números y literales", () => {
    const tokens = tokenizeJson('[1.5,-2,"x",true,false,null]');
    expect(tokens.find((t) => t.value === "1.5")?.kind).toBe("number");
    expect(tokens.find((t) => t.value === "-2")?.kind).toBe("number");
    expect(tokens.find((t) => t.value === "true")?.kind).toBe("boolean");
    expect(tokens.find((t) => t.value === "false")?.kind).toBe("boolean");
    expect(tokens.find((t) => t.value === "null")?.kind).toBe("null");
  });

  it("escapa strings con comillas internas", () => {
    const tokens = tokenizeJson('{ "q": "di \\"hola\\"" }');
    const value = tokens.find((t) => t.kind === "string");
    expect(value?.value).toBe('"di \\"hola\\""');
  });
});

describe("tokenizeBody", () => {
  it("tokeniza JSON válido", () => {
    const tokens = tokenizeBody('{"n": 3}');
    expect(tokens).not.toBeNull();
    expect(tokens?.some((t) => t.kind === "number")).toBe(true);
  });

  it("devuelve null con texto que no es JSON", () => {
    expect(tokenizeBody("hello world")).toBeNull();
  });
});
