/* Parser de argv de Estela SIN depender del "--" (el shim estela.ps1 de npm
   en PowerShell SE COME el "--" antes de llegar a node; npx hace algo
   parecido). Reglas:
   1. Consume opciones de Estela en orden (--port N, --log RUTA repetible,
      --no-open, -h/--help, y las variantes --port=N / --log=RUTA).
   2. Al ver "--", todo lo que sigue es el comando del usuario.
   3. Al ver un argumento que NO es opción de Estela, desde ahí TODO es el
      comando del usuario (incluidas SUS opciones).
   4. Una opción desconocida ANTES del comando → error claro en español. */
import { describe, expect, it } from "vitest";
import { parseEstelaArgv } from "./cli-argv.js";

describe("parseEstelaArgv — comando sin --", () => {
  it("todo lo que no es opción de Estela es el comando, desde el primer token", () => {
    const result = parseEstelaArgv(["npm", "run", "dev"]);
    expect(result).toEqual({ ok: true, args: { port: undefined, logFiles: [], noOpen: false, help: false, command: ["npm", "run", "dev"] } });
  });

  it("las opciones del usuario dentro del comando son SUYAS: npm run dev --port 8000", () => {
    const result = parseEstelaArgv(["npm", "run", "dev", "--port", "8000", "-u"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.port).toBeUndefined();
    expect(result.args.command).toEqual(["npm", "run", "dev", "--port", "8000", "-u"]);
    expect(result.args.logFiles).toEqual([]);
  });

  it("opciones de Estela ANTES del comando se consumen; el resto es el comando", () => {
    const result = parseEstelaArgv(["--port", "4100", "node", "server.js", "--port", "3000"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.port).toBe(4100);
    expect(result.args.command).toEqual(["node", "server.js", "--port", "3000"]);
  });

  it("mezcla completa: --no-open y --log antes; python con sus propias opciones", () => {
    const result = parseEstelaArgv(["--no-open", "--log", "app.log", "python", "-u", "app.py", "--port", "8000"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.noOpen).toBe(true);
    expect(result.args.logFiles).toEqual(["app.log"]);
    expect(result.args.command).toEqual(["python", "-u", "app.py", "--port", "8000"]);
  });

  it("comando que empieza con -- también se toma como comando del usuario", () => {
    // Caso raro: el comando del usuario empieza con guión. Sin "--" no hay
    // forma de distinguirlo de una opción de Estela → se trata como opción
    // desconocida (error en español). Con "--" adelante va bien.
    const withDashDash = parseEstelaArgv(["--", "-x", "flag"]);
    expect(withDashDash.ok).toBe(true);
    if (!withDashDash.ok) {
      throw new Error("debió parsear");
    }
    expect(withDashDash.args.command).toEqual(["-x", "flag"]);
  });
});

describe("parseEstelaArgv — comando con --", () => {
  it("todo lo que sigue al -- es el comando, tal cual", () => {
    const result = parseEstelaArgv(["--port", "4100", "--", "npm", "run", "dev", "--", "otro"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.port).toBe(4100);
    expect(result.args.command).toEqual(["npm", "run", "dev", "--", "otro"]);
  });

  it("el -- dentro del comando del usuario se conserva", () => {
    const result = parseEstelaArgv(["tee", "--", "salida.txt"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.command).toEqual(["tee", "--", "salida.txt"]);
  });

  it("-- solo: no hay comando (el CLI avisará que falta)", () => {
    const result = parseEstelaArgv(["--"]);
    expect(result).toEqual({ ok: true, args: { port: undefined, logFiles: [], noOpen: false, help: false, command: [] } });
  });

  it("las opciones después del -- NO son de Estela: no se consumen", () => {
    const result = parseEstelaArgv(["--", "npm", "run", "dev", "--no-open"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.noOpen).toBe(false);
    expect(result.args.command).toEqual(["npm", "run", "dev", "--no-open"]);
  });
});

describe("parseEstelaArgv — opciones de Estela", () => {
  it("--port N antes del comando", () => {
    const result = parseEstelaArgv(["--port", "4100"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.port).toBe(4100);
    expect(result.args.command).toEqual([]);
  });

  it("--port=N con igual", () => {
    const result = parseEstelaArgv(["--port=4100", "npm", "start"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.port).toBe(4100);
    expect(result.args.command).toEqual(["npm", "start"]);
  });

  it("--log repetible acumula rutas", () => {
    const result = parseEstelaArgv(["--log", "a.log", "--log", "b.log", "node", "app.js"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.logFiles).toEqual(["a.log", "b.log"]);
  });

  it("--log=default.log y --log=otro.log con igual", () => {
    const result = parseEstelaArgv(["--log=default.log", "--log=otro.log"]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("debió parsear");
    }
    expect(result.args.logFiles).toEqual(["default.log", "otro.log"]);
  });

  it("--no-open false por defecto; -h y --help activan help", () => {
    const none = parseEstelaArgv([]);
    expect(none.ok).toBe(true);
    const short = parseEstelaArgv(["-h"]);
    expect(short.ok).toBe(true);
    if (!short.ok) {
      throw new Error("debió parsear");
    }
    expect(short.args.help).toBe(true);
    const long = parseEstelaArgv(["--help", "node", "x.js"]);
    expect(long.ok).toBe(true);
    if (!long.ok) {
      throw new Error("debió parsear");
    }
    expect(long.args.help).toBe(true);
    expect(long.args.command).toEqual(["node", "x.js"]);
  });

  it("sin opciones y sin comando: ok con comando vacío (el CLI imprime el uso)", () => {
    const result = parseEstelaArgv([]);
    expect(result).toEqual({ ok: true, args: { port: undefined, logFiles: [], noOpen: false, help: false, command: [] } });
  });
});

describe("parseEstelaArgv — errores claros en español", () => {
  it("opción desconocida antes del comando: mensaje que sugiere usar --", () => {
    const result = parseEstelaArgv(["--debug", "npm", "run", "dev"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("--debug");
    expect(result.message).toContain("no conozco");
    expect(result.message).toContain("-- <tu comando>");
  });

  it("opción corta desconocida también falla", () => {
    const result = parseEstelaArgv(["-x", "npm", "run", "dev"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("-x");
  });

  it("--port sin valor: mensaje claro", () => {
    const result = parseEstelaArgv(["--port"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("--port");
  });

  it("--port con valor no numérico: mensaje claro", () => {
    const result = parseEstelaArgv(["--port", "mucho"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("mucho");
  });

  it("--log sin valor: mensaje claro", () => {
    const result = parseEstelaArgv(["--log"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("--log");
  });

  it("--port= vacío: mensaje claro", () => {
    const result = parseEstelaArgv(["--port="]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("debió fallar");
    }
    expect(result.message).toContain("--port");
  });

  it("los errores no mencionan stack ni TypeError", () => {
    const cases = [["--bogus"], ["--port"], ["--port", "mucho"], ["--log"], ["-x"]];
    for (const argv of cases) {
      const result = parseEstelaArgv(argv);
      expect(result.ok, JSON.stringify(argv)).toBe(false);
      if (result.ok) {
        throw new Error("debió fallar");
      }
      expect(result.message).not.toContain("TypeError");
      expect(result.message).not.toContain("at ");
    }
  });
});
