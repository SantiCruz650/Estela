import { describe, expect, it } from "vitest";
import { USAGE } from "./usage.js";

/* Reglas de la ayuda:
   1. El comando recomendado hoy es el modo proceso: `estela -- <tu comando>`.
   2. El paquete npm sin scope "estela" es de otra persona: nunca sugerir
      "npx estela" sin el scope @estela-dev. */

describe("texto de --help", () => {
  it("recomienda primero el modo proceso (un comando, sin archivos)", () => {
    expect(USAGE).toContain("npx @estela-dev/cli -- npm run dev");
    expect(USAGE).toContain("npx @estela-dev/cli --port 4100 -- python -u app.py");
  });

  it("documenta que todo tras -- es el comando del usuario", () => {
    expect(USAGE).toContain("es TU comando");
  });

  it("el modo archivo sigue disponible y combinable tras el --", () => {
    expect(USAGE).toContain("npx @estela-dev/cli --port 4000 --log ruta/al/archivo.log");
    expect(USAGE).toContain("--log ./logs/app.log --log ./logs/errors.log -- npm run dev");
  });

  it("no sugiere 'npx estela' sin el scope en ningún punto", () => {
    expect(USAGE).not.toMatch(/npx estela(?!-)/);
  });

  it("contiene las opciones documentadas", () => {
    expect(USAGE).toContain("--port");
    expect(USAGE).toContain("--log");
    expect(USAGE).toContain("--no-open");
    expect(USAGE).toContain("--help");
  });
});
