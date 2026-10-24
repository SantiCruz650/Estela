#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createCliServer, generateToken } from "./server.js";

const USAGE = `Estela CLI — sirve Estela en local y puentea tu backend sin CORS.

Uso:
  npx estela [--port 4000] [--log ruta/al/archivo.log] [--no-open]

Opciones:
  --port <n>     Puerto (defecto 4000). Siempre escucha en 127.0.0.1.
  --log <ruta>   Archivo de log a exponer en GET /api/tail (repetible).
  --no-open     No abrir el navegador (útil en servidores o pruebas).
  -h, --help     Muestra esta ayuda.
`;

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
  const { values } = parseArgs({
    options: {
      port: { type: "string" },
      log: { type: "string", multiple: true },
      "no-open": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help === true) {
    console.log(USAGE);
    process.exit(0);
  }

  const port = Number(values.port ?? "4000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`puerto inválido: ${values.port ?? ""} (usa --port <1-65535>)`);
  }

  const logFiles = (values.log ?? []).map((path) => resolve(path));
  const distDir = resolveDistDir();
  if (distDir === null) {
    fail(
      "no encuentro el build embebido de Estela (dist/web/index.html). "
      + "Reinstala el paquete o define ESTELA_DIST=<ruta>.",
    );
  }

  const token = generateToken();
  const server = createCliServer({ port, distDir, logFiles, token });

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
    console.log(`  (solo 127.0.0.1 — token de sesión activo${logFiles.length > 0 ? ` — ${logFiles.length} archivo(s) de log` : ""})`);
    if (values["no-open"] !== true) {
      openBrowser(appUrl);
    } else {
      console.log("  (--no-open: navegador no abierto)");
    }
  });

  const shutdown = (): void => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
