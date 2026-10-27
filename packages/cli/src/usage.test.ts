import { describe, expect, it } from "vitest";
import { USAGE } from "./usage.js";

/* Regla: el paquete npm sin scope "estela" es de otra persona.
   La ayuda nunca debe sugerir "npx estela" sin el scope @estela-dev. */

describe("texto de --help", () => {
  it("la línea de uso usa el comando con scope completo", () => {
    expect(USAGE).toContain(
      "npx @estela-dev/cli [--port 4000] [--log ruta/al/archivo.log] [--no-open]",
    );
  });

  it("no sugiere 'npx estela' sin el scope en ningún punto", () => {
    // "npx estela" seguido de lo que sea (espacio, salto o fin), siempre que
    // no sea la forma válida "npx estela-dev/cli".
    expect(USAGE).not.toMatch(/npx estela(?!-)/);
  });

  it("contiene las opciones documentadas", () => {
    expect(USAGE).toContain("--port");
    expect(USAGE).toContain("--log");
    expect(USAGE).toContain("--no-open");
    expect(USAGE).toContain("--help");
  });
});
