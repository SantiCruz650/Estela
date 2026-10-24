// Copia el build de la web (packages/web/dist) dentro del paquete CLI
// (packages/cli/dist/web) para que el .tgz publicado sea autocontenido.
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, "..");
const source = join(cliRoot, "..", "web", "dist");
const target = join(cliRoot, "dist", "web");

if (!existsSync(join(source, "index.html"))) {
  console.error(
    `copy-web-dist: no existe ${source}. Ejecuta \`npm run build -w web\` antes de construir el CLI.`,
  );
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`copy-web-dist: web/dist → packages/cli/dist/web`);
