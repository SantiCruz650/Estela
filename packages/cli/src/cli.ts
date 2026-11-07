#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEstelaArgv, processCommandLabel } from "@devtool/core";
import { createCliServer, generateToken } from "./server.js";
import { spawnProcess, type ProcessRun } from "./process-runner.js";
import { USAGE } from "./usage.js";

function openBrowser(url: string): void {
  let command: string;
  let args: string[];
  if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
      // Sin navegador disponible: el usuario tiene la URL impresa.
    });
    child.unref();
  } catch {
    // Idem: nunca romper el servidor por no poder abrir el navegador.
  }
}

function resolveDistDir(): string | null {
  // Este archivo vive en <paquete>/dist/cli.js; el build embebido está en <paquete>/dist/web.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.ESTELA_DIST,
    join(here, "web"),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate !== "");
  return candidates.find((candidate) => existsSync(join(candidate, "index.html"))) ?? null;
}

function fail(message: string): never {
  console.error(`estela: ${message}`);
  process.exit(1);
}

function main(): void {
  // Parseo propio SIN depender del "--": el shim estela.ps1 de npm en
  // PowerShell (y npx) se lo come antes de llegarnos. Opciones de Estela
  // en orden; el primer token que no es opción arranca el comando del usuario.
  const parsed = parseEstelaArgv(process.argv.slice(2));
  if (!parsed.ok) {
    console.log(USAGE);
    fail(parsed.message);
  }
  const { port: portArg, logFiles: logArgs, noOpen, help, command: commandTokens } = parsed.args;

  if (help) {
    console.log(USAGE);
    process.exit(0);
  }

  const port = portArg ?? 4000;
  if (port < 1 || port > 65535) {
    fail(`puerto inválido: ${port} (usa --port <1-65535>)`);
  }

  const logFiles = logArgs.map((path) => resolve(path));
  const distDir = resolveDistDir();
  if (distDir === null) {
    fail(
      "no encuentro el build embebido de Estela (dist/web/index.html). "
      + "Reinstala el paquete o define ESTELA_DIST=<ruta>.",
    );
  }

  const processMode = commandTokens.length > 0;
  if (commandTokens.length === 0 && logFiles.length === 0) {
    console.log(USAGE);
    console.log("\nestela: falta el comando. Pasa tu backend con \"--\" (o sin él), p. ej.:");
    console.log("  npx @estela-dev/cli -- npm run dev");
    console.log("  npx @estela-dev/cli npm run dev           (también sin --)");
    console.log("  npx @estela-dev/cli --log ruta/al/archivo.log   (modo archivo de log)");
    process.exit(1);
  }

  // Modo proceso: arranca TU backend y captura su salida (hora exacta por línea).
  let run: ProcessRun | null = null;
  if (processMode) {
    run = spawnProcess(commandTokens);
    run.onExit((code) => {
      if (code === null) {
        console.log("(tu proceso se cerró sin código de salida)");
        return;
      }
      console.log(`(tu proceso terminó con código ${code} — Estela sigue abierta)`);
    });
  }

  const token = generateToken();
  const server = createCliServer({
    port,
    distDir,
    logFiles,
    token,
    ...(run !== null ? { processLog: { command: processCommandLabel(commandTokens), buffer: run.buffer } } : {}),
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      fail(`el puerto ${port} ya está en uso (prueba --port otro)`);
    }
    fail(error.message);
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address !== null ? address.port : port;
    const appUrl = `http://localhost:${boundPort}/app`;
    console.log(`Estela sirviendo en ${appUrl}`);
    const subtitle = processMode
      ? `proceso: ${processCommandLabel(commandTokens)}${logFiles.length > 0 ? ` + ${logFiles.length} archivo(s) de log` : ""}`
      : `[solo 127.0.0.1 — token de sesión activo${logFiles.length > 0 ? ` — ${logFiles.length} archivo(s) de log` : ""}]`;
    console.log(`  (${subtitle})`);
    if (noOpen) {
      console.log("  (--no-open: navegador no abierto)");
    } else {
      openBrowser(appUrl);
    }
  });

  const shutdown = (): void => {
    // Ctrl+C: SIEMPRE matar también el proceso del usuario (y sus subprocesos):
    // no deben quedar servidores huérfanos ocupando puertos.
    run?.dispose();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Última oportunidad si el proceso muere sin pasar por SIGINT (best effort).
  process.on("exit", () => {
    try {
      run?.dispose();
    } catch {
      // ya en cierre: nada más que hacer
    }
  });
}

main();
