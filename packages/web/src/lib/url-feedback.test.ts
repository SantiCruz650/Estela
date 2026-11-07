import { describe, expect, it } from "vitest";
import { urlNotice } from "./url-feedback";

describe("aviso de la URL (B-10)", () => {
  it("URL limpia y completa: sin aviso, no bloquea nada", () => {
    expect(urlNotice("http://localhost:3000/api/users")).toBeNull();
    expect(urlNotice("https://api.ejemplo.com/x?y=1")).toBeNull();
  });

  it("espacios SOLO al inicio o al final: SIN aviso (al enviar se recortan)", () => {
    expect(urlNotice(" http://localhost:3000/api/x")).toBeNull();
    expect(urlNotice("http://localhost:3000/api/x ")).toBeNull();
    expect(urlNotice("  https://api.ejemplo.com  ")).toBeNull();
    expect(urlNotice("\thttp://localhost:3000/api/x\n")).toBeNull();
  });

  it("espacios EN MEDIO de la URL: avisa", () => {
    expect(urlNotice("http://localhost:3000/api/x y-z")).not.toBeNull();
    expect(urlNotice("http://localhost:3000  /api/x")).not.toBeNull();
  });

  it("URL sin esquema http/https: avisa (incluso con extremos recortables)", () => {
    expect(urlNotice("localhost:3000/api/users")).not.toBeNull();
    expect(urlNotice("ftp://files.ejemplo.com")).not.toBeNull();
    expect(urlNotice(" localhost:3000/api/users ")).not.toBeNull();
  });

  it("vacío: sin aviso (el botón de envío ya está deshabilitado)", () => {
    expect(urlNotice("")).toBeNull();
    expect(urlNotice("   ")).toBeNull();
  });
});
