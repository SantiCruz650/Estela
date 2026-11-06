// Runtime del CLI autocontenido: el .tgz publicado NO trae dependencias.
// Core vive en packages/core/src (TypeScript); para el dist del CLI:
//   1) rm+mkdir del vendor y tsc compila core/src/index.ts → dist/core-src
//      (plano, ESM NodeNext: las importaciones relativas *.js de core ya
//      apuntan a los archivos compilados vecinos).
//   2) Todas las importaciones "@devtool/core" emitidas por tsc en dist/*.js
//      se reescriben a "./core-src/index.js" para que node las resuelva sin
//      node_modules (npx no instala @devtool/core).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, "..");
const repoRoot = join(cliRoot, "..", "..");
const coreSrc = join(repoRoot, "packages", "core", "src");
const vendorOut = join(cliRoot, "dist", "core-src");
const tsc = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function fail(message) {
  console.error(`compile-cli-runtime: ${message}`);
  process.exit(1);
}

if (!existsSync(tsc)) {
  fail(`no encuentro typescript en ${tsc} (¿npm install?)`);
}

// 1. Vendor de core (limpio: se regenera cada build).
await rm(vendorOut, { recursive: true, force: true });
const compile = spawnSync(
  process.execPath,
  [
    tsc,
    join(coreSrc, "index.ts"),
    "--strict",
    // TS ≥ 6: tsconfig.json del cwd no aplica al pasar archivos por línea y
    // exige esta marca para decirlo explícitamente.
    "--ignoreConfig",
    "--module", "nodenext",
    "--moduleResolution", "nodenext",
    "--target", "es2022",
    "--declaration", "false",
    "--skipLibCheck",
    "--noEmitOnError", "true",
    "--outDir", vendorOut,
    "--rootDir", coreSrc,
  ],
  { stdio: "pipe", encoding: "utf8" },
);
if (compile.status !== 0) {
  fail(`tsc core falló:\n${compile.stdout ?? ""}\n${compile.stderr ?? ""}`);
}

// 2. Reescribe el specifier "@devtool/core" en el JS emitido del CLI.
async function rewriteImports(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // El vendor ya está enlazado relativo; la web embebida no cambia.
      if (entry.name === "core-src" || entry.name === "web") {
        continue;
      }
      await rewriteImports(full);
      continue;
    }
    if (entry.name.endsWith(".js")) {
      const content = await readFile(full, "utf8");
      if (content.includes('"@devtool/core"')) {
        await writeFile(full, content.replaceAll('"@devtool/core"', '"./core-src/index.js"'), "utf8");
      }
    }
  }
}

await rewriteImports(cliRoot);
console.log("compile-cli-runtime: core vendido (dist/core-src) y specifiers reescritos");
