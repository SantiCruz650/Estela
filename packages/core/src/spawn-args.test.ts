/* Modo proceso: separación de opciones y comando alrededor del separador "--".
   En `npx @estela-dev/cli --port 4000 -- npm run dev`, el "--" separa las
   opciones de Estela (antes) del comando del usuario (después).
   Entra el argv YA SIN intérprete ni script (cli.ts hace argv.slice(2)). */
import { describe, expect, it } from "vitest";
import { splitArgvAtDashDash, spawnPlanForCommand, processChildEnv, processCommandLabel } from "./spawn-args.js";

describe("splitArgvAtDashDash", () => {
  it("sin --: solo opciones de Estela, comando vacío", () => {
    const args = splitArgvAtDashDash(["--port", "4100", "--no-open"]);
    expect(args.before).toEqual(["--port", "4100", "--no-open"]);
    expect(args.command).toEqual([]);
  });

  it("con --: todo lo que sigue es el comando del usuario", () => {
    const args = splitArgvAtDashDash(["--port", "4100", "--", "npm", "run", "dev"]);
    expect(args.before).toEqual(["--port", "4100"]);
    expect(args.command).toEqual(["npm", "run", "dev"]);
  });

  it("el -- va primero: comando completo de una vez", () => {
    const args = splitArgvAtDashDash(["--", "python", "-u", "app.py"]);
    expect(args.before).toEqual([]);
    expect(args.command).toEqual(["python", "-u", "app.py"]);
  });

  it("varios --: solo el primero separa", () => {
    const args = splitArgvAtDashDash(["--", "npm", "--", "test"]);
    expect(args.command).toEqual(["npm", "--", "test"]);
  });

  it("sin nada después de --: comando vacío", () => {
    const args = splitArgvAtDashDash(["--"]);
    expect(args.command).toEqual([]);
  });

  it("sin -- en absoluto: no hay modo proceso (todo son opciones)", () => {
    const args = splitArgvAtDashDash(["--port", "4100"]);
    expect(args.before).toEqual(["--port", "4100"]);
    expect(args.command).toEqual([]);
  });
});

describe("processCommandLabel", () => {
  it("une el comando del usuario tal cual", () => {
    expect(processCommandLabel(["npm", "run", "dev"])).toBe("npm run dev");
  });
});

describe("processChildEnv", () => {
  it("agrega las variables que desactivan color y buffering", () => {
    const env = processChildEnv();
    expect(env).toMatchObject({
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      PYTHONUNBUFFERED: "1",
    });
  });
});

describe("spawnPlanForCommand", () => {
  it("en Windows: shell true y comando como string único (npm es npm.cmd)", () => {
    const plan = spawnPlanForCommand(["npm", "run", "dev"], "win32");
    expect(plan.useShell).toBe(true);
    expect(plan.commandString).toBe("npm run dev");
  });

  it("en Windows: token con espacios (ruta de node) sale ENTRECOMILLADO", () => {
    const plan = spawnPlanForCommand(["C:\\Program Files\\nodejs\\node.exe", "server.js"], "win32");
    expect(plan.commandString).toBe('"C:\\Program Files\\nodejs\\node.exe" server.js');
  });

  it("en Windows: comillas internas se escapan", () => {
    const plan = spawnPlanForCommand(['mi"exe.exe', "x"], "win32");
    expect(plan.commandString).toBe('"mi\\"exe.exe" x');
  });

  it("en macOS y Linux: sin shell, spawn por token con array (comillas intactas)", () => {
    const plan = spawnPlanForCommand(["python", "-u", "app.py"], "linux");
    expect(plan.useShell).toBe(false);
    expect(plan.commandString).toBeNull();
    expect(plan.argv).toEqual(["python", "-u", "app.py"]);
  });
});
