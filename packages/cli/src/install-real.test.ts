/**
 * Test de instalación REAL en Windows (reproduce el bug 0.1.3):
 *
 *   npm pack → npm install -g --prefix <temporal> → ejecutar los
 *   INTERMEDIARIOS que genera npm y npx con paquete local:
 *     1. estela.ps1 con --   (invocado como hace PowerShell: se lo come)
 *     2. estela.ps1 sin --   (mismo camino, directamente sin el separador)
 *     3. estela.cmd desde cmd (-- llega intacto)
 *     4. npx --yes @estela-dev/cli -- node -e …  (paquete en node_modules
 *        de un proyecto temporal, como haría un usuario)
 *     5. npx --yes @estela-dev/cli node -e …   (sin --)
 *
 * En todos: el hijo arranca (su salida "req=test" aparece eco en la
 * terminal del CLI; su CHILDARGV prueba que node solo recibió "-e"), y
 * Estela muere limpio al cerrar. Nota aprendida: `npx --yes <ruta.tgz>`
 * es un no-op SILLENCIOSO (exit 0, sin salida); npx solo corre specs de
 * nombre, no tarballs locales.
 * Se salta fuera de Windows (los shims .ps1/.cmd no existen).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, "..");
const repoRoot = join(cliRoot, "..", "..");
const distCli = join(cliRoot, "dist", "cli.js");
const distWebIndex = join(cliRoot, "dist", "web", "index.html");

/** mtime más reciente bajo root (ignora node_modules/dist/ocultos). */
function newestMtime(root: string): number {
  let newest = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
        continue;
      }
      newest = Math.max(newest, newestMtime(full));
    } else if (!/\.(test|spec)\.(ts|tsx|mts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  }
  return newest;
}

/** Rebuild del dist si alguna fuente (cli/core/web) es más nueva que el dist. */
function ensureFreshBuild(): void {
  const cliMtime = existsSync(distCli) ? statSync(distCli).mtimeMs : 0;
  const webMtime = existsSync(distWebIndex) ? statSync(distWebIndex).mtimeMs : 0;
  const srcNewest = Math.max(
    ...[join(cliRoot, "src"), join(repoRoot, "packages", "core", "src"), join(repoRoot, "packages", "web", "src")].map(
      (src) => newestMtime(src),
    ),
  );
  if (existsSync(distCli) && existsSync(distWebIndex) && cliMtime >= srcNewest && webMtime >= srcNewest) {
    return;
  }
  const build = spawnSync("npm", ["run", "build", "-w", "@estela-dev/cli"], {
    cwd: repoRoot,
    stdio: "pipe",
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (build.status !== 0) {
    throw new Error(`build del CLI falló (${build.status}): ${String(build.stdout ?? "")}${String(build.stderr ?? "")}`.slice(-1200));
  }
}

/** El hijo del CLI imprime su salida Y SUS ARGV para documentar qué llega. */
const CHILD_CODE =
  "const argv=JSON.stringify(process.argv.slice(1));console.log('req=test');console.log('CHILDARGV:'+argv);";

interface RunResult {
  stdout: string;
  stderr: string;
  seen: boolean;
}

/** Corre el proceso, espera que TODOS los patterns aparezcan en stdout,
 *  mata su árbol (shim → node cli → hijo del usuario) y devuelve la salida. */
function runEstela(
  make: () => { proc: ChildProcess; label: string },
  waitPatterns: RegExp[],
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const { proc, label } = make();
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += String(d)));
    proc.stderr?.on("data", (d) => (stderr += String(d)));
    const started = Date.now();
    let settled = false;
    const finish = (seen: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      // Mata TODO el árbol; hace falta porque Ctrl+C real no existe aquí.
      if (proc.pid !== undefined && proc.exitCode === null && proc.signalCode === null) {
        const killer = spawn("taskkill.exe", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
        killer.on("error", () => {
          // best effort
        });
      }
      const poll = setInterval(() => {
        if (proc.pid === undefined || proc.exitCode !== null || proc.signalCode !== null || Date.now() - started > 20000) {
          clearInterval(poll);
          resolve({ stdout, stderr, seen });
        }
      }, 100);
    };
    const poll = setInterval(() => {
      // El error de opción desconocida sale por stderr; el normal por stdout.
      const combined = stdout + stderr;
      if (waitPatterns.every((pattern) => pattern.test(combined))) {
        clearInterval(poll);
        finish(true);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        finish(false);
      }
    }, 100);
    proc.on("error", (error) => {
      clearInterval(poll);
      stderr += `\nspawn-error: ${String(error)}`;
      finish(false);
    });
    void label;
  });
}

/** Busca un archivo por nombre bajo root (bfs, profundidad corta). */
function findFile(root: string, name: string, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === name) {
      return join(root, entry.name);
    }
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findFile(join(root, entry.name), name, depth + 1);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}

describe.skipIf(process.platform !== "win32")("instalación real (npm pack + install -g + shims de npm)", () => {
  const workspace = mkdtempSync(join(tmpdir(), "estela-install-"));
  const packDir = join(workspace, "pack");
  const prefix = join(workspace, "prefix");
  const projectDir = join(workspace, "project");
  let tgzPath = "";
  let ps1Shim = "";
  let cmdShim = "";

  beforeAll(async () => {
    ensureFreshBuild();
    // 1) npm pack del paquete (incluye dist/cli.js + dist/web autocontenido).
    //    --pack-destination exige que la carpeta exista.
    mkdirSync(packDir, { recursive: true });
    const packed = spawnSync("npm", ["pack", "--pack-destination", packDir], {
      cwd: cliRoot,
      stdio: "pipe",
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    if (packed.status !== 0) {
      throw new Error(`npm pack falló (${packed.status}): ${String(packed.stdout ?? "")}${String(packed.stderr ?? "")}`.slice(-1200));
    }
    const packOut = String(packed.stdout ?? "");
    const tgzName = /(\S+\.tgz)\s*$/m.exec(packOut)?.[1];
    if (tgzName === undefined) {
      throw new Error(`npm pack no devolvió el nombre del .tgz: ${packOut.slice(-300)}`);
    }
    tgzPath = join(packDir, tgzName);
    expect(existsSync(tgzPath)).toBe(true);

    // 2) npm install -g al prefijo temporal (genera estela.ps1 + estela.cmd).
    const installed = spawnSync("npm", ["install", "-g", "--prefix", prefix, tgzPath], {
      cwd: workspace, // fuera del monorepo: que npm no herede workspaces
      stdio: "pipe",
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    if (installed.status !== 0) {
      throw new Error(`npm install -g falló (${installed.status}): ${String(installed.stdout ?? "")}${String(installed.stderr ?? "")}`.slice(-1200));
    }
    ps1Shim = findFile(prefix, "estela.ps1") ?? "";
    cmdShim = findFile(prefix, "estela.cmd") ?? "";
    expect(ps1Shim, "npm no generó estela.ps1 en el prefijo").not.toBe("");
    expect(cmdShim, "npm no generó estela.cmd en el prefijo").not.toBe("");

    // 3) Proyecto temporal con el paquete como dependencia (para npx local).
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: "estela-npx-project", version: "1.0.0", private: true }),
      "utf8",
    );
    const projectInstalled = spawnSync("npm", ["install", tgzPath, "--prefix", projectDir], {
      cwd: projectDir,
      stdio: "pipe",
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    if (projectInstalled.status !== 0) {
      throw new Error(
        `npm install en proyecto falló (${projectInstalled.status}): ${String(projectInstalled.stdout ?? "")}${String(projectInstalled.stderr ?? "")}`.slice(-1200),
      );
    }
    expect(existsSync(join(projectDir, "node_modules", ".bin", "estela.cmd")), "npx no verá el bin local").toBe(true);
  }, 300_000);

  afterAll(async () => {
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch {
      // Windows puede retener archivos un momento tras el kill.
    }
  });

  /** Espera banner + echo del hijo (req=test) + subtítulo de proceso. */
  const WAIT: RegExp[] = [/Estela sirviendo en http:\/\/localhost:\d+\/app/, /proceso: node/, /req=test/];

  it("1. PowerShell: estela.ps1 -- node -e … (PowerShell se come el --)", { timeout: 120_000 }, async () => {
    const port = 42100 + Math.floor(Math.random() * 4000);
    // Invocación idéntica a la de la consola del usuario: & 'shim' argumentos.
    // PowerShell 5 parsing SE COME el "--" antes de llegar al shim.
    const psCommand = `& '${ps1Shim}' --port ${port} -- node -e "${CHILD_CODE}"`;
    const result = await runEstela(
      () => ({
        proc: spawn("powershell.exe", ["-NoProfile", "-Command", psCommand], { stdio: ["ignore", "pipe", "pipe"] }),
        label: "ps1 con --",
      }),
      WAIT,
      90_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-800)}\nstderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stderr).not.toMatch(/ERR_|TypeError|at \S+:\d+/);
    // node -e no añade argv: vacío = el "--" ni tokens de Estela se colaron.
    expect(result.stdout).toContain("CHILDARGV:[]");
  });

  it("2. PowerShell: estela.ps1 node -e … (sin --, el shim tampoco lo pide)", { timeout: 120_000 }, async () => {
    const port = 46100 + Math.floor(Math.random() * 4000);
    const psCommand = `& '${ps1Shim}' --port ${port} node -e "${CHILD_CODE}"`;
    const result = await runEstela(
      () => ({
        proc: spawn("powershell.exe", ["-NoProfile", "-Command", psCommand], { stdio: ["ignore", "pipe", "pipe"] }),
        label: "ps1 sin --",
      }),
      WAIT,
      90_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-800)}\nstderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stderr).not.toMatch(/ERR_|TypeError|at \S+:\d+/);
    expect(result.stdout).toContain("CHILDARGV:[]");
  });

  it("3. cmd: estela.cmd -- node -e … (cmd pasa %* intacto)", { timeout: 120_000 }, async () => {
    const port = 50100 + Math.floor(Math.random() * 4000);
    const result = await runEstela(
      () => ({
        proc: spawn("cmd.exe", ["/c", cmdShim, "--port", String(port), "--", "node", "-e", CHILD_CODE], {
          stdio: ["ignore", "pipe", "pipe"],
        }),
        label: "cmd con --",
      }),
      WAIT,
      90_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-800)}\nstderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stderr).not.toMatch(/ERR_|TypeError|at \S+:\d+/);
    expect(result.stdout).toContain("CHILDARGV:[]");
  });

  it("4. npx --yes @estela-dev/cli -- node -e … (paquete local)", { timeout: 150_000 }, async () => {
    const port = 54100 + Math.floor(Math.random() * 4000);
    const result = await runEstela(
      () => ({
        proc: spawn(
          "cmd.exe",
          ["/c", "npx", "--yes", "@estela-dev/cli", "--port", String(port), "--", "node", "-e", CHILD_CODE],
          {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: projectDir,
          },
        ),
        label: "npx con --",
      }),
      WAIT,
      120_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-1000)}\nstderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stdout).toContain("CHILDARGV:[]");
  });

  it("5. npx --yes @estela-dev/cli node -e … (sin --)", { timeout: 150_000 }, async () => {
    const port = 58100 + Math.floor(Math.random() * 4000);
    const result = await runEstela(
      () => ({
        proc: spawn(
          "cmd.exe",
          ["/c", "npx", "--yes", "@estela-dev/cli", "--port", String(port), "node", "-e", CHILD_CODE],
          {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: projectDir,
          },
        ),
        label: "npx sin --",
      }),
      WAIT,
      120_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-1000)}\nstderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stdout).toContain("CHILDARGV:[]");
  });

  it("6. opción desconocida instalada: error en español, sin stack trace", { timeout: 90_000 }, async () => {
    const result = await runEstela(
      () => ({
        proc: spawn("cmd.exe", ["/c", cmdShim, "--port", "4001", "--tocino", "node", "-e", CHILD_CODE], {
          stdio: ["ignore", "pipe", "pipe"],
        }),
        label: "cmd opción desconocida",
      }),
      [/no conozco la opción/],
      60_000,
    );
    expect(result.seen, `stdout=${result.stdout.slice(-500)} stderr=${result.stderr.slice(-400)}`).toBe(true);
    expect(result.stderr).not.toMatch(/ERR_|TypeError|at \S+:\d+/);
  });
});
