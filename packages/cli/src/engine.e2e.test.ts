/**
 * Test e2e REAL (sin mocks): CLI compilado + Chrome headless vía CDP.
 *
 * Escenario del bug 0.1.1: `estela --log <archivo>` y la fuente "Backend local"
 * debian hacer polling a /api/tail y pintar las líneas nuevas en el panel.
 *
 * Levanta el binario compilado con un archivo de log de ruta Windows con
 * espacios (barras invertidas nativas), abre /app en Chrome headless,
 * selecciona "Backend local", agrega al archivo una línea con req=<id> y
 * verifica que:
 *   (a) hubo peticiones a /api/tail con status 200, y
 *   (b) la línea aparece en el panel, con el indicador "En vivo".
 *
 * Se salta si no hay Chrome instalado en la máquina.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, appendFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import * as wsModule from "ws";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, "..");
const repoRoot = join(cliRoot, "..", "..");
const distCli = join(cliRoot, "dist", "cli.js");
const distWebIndex = join(cliRoot, "dist", "web", "index.html");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];
const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

const WebSocket = (wsModule as { default?: typeof wsModule.WebSocket }).default ?? wsModule.WebSocket;

/** Cliente CDP mínimo sobre WebSocket con sesiones flatten. */
function connectCdp(wsUrl: string): {
  send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<Record<string, unknown>>;
  wsEvents: (listener: (event: { method: string; sessionId: string; params: Record<string, unknown> }) => void) => () => void;
  close: () => Promise<void>;
} {
  const ws = new WebSocket(wsUrl, { maxPayload: 100 * 1024 * 1024 });
  let nextId = 0;
  const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(event: { method: string; sessionId: string; params: Record<string, unknown> }) => void>();
  const sendQueue: Array<string> = [];
  const flush = (): void => {
    for (const payload of sendQueue.splice(0)) ws.send(payload);
  };
  ws.on("open", () => {
    flush();
  });
  ws.on("message", (data: wsModule.RawData) => {
    const msg = JSON.parse(String(data)) as {
      id?: number; error?: unknown; result?: Record<string, unknown>;
      method?: string; sessionId?: string; params?: Record<string, unknown>;
    };
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (entry !== undefined) {
        pending.delete(msg.id);
        if (msg.error !== undefined && msg.error !== null) {
          entry.reject(new Error(JSON.stringify(msg.error)));
        } else {
          entry.resolve(msg.result ?? {});
        }
      }
      return;
    }
    if (msg.method !== undefined) {
      const event = { method: msg.method, sessionId: msg.sessionId ?? "", params: msg.params ?? {} };
      for (const listener of listeners) listener(event);
    }
  });
  return {
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        const payload = JSON.stringify({
          id,
          ...(sessionId !== undefined ? { sessionId } : {}),
          method,
          params,
        });
        if (ws.readyState === wsModule.WebSocket.OPEN) {
          ws.send(payload);
        } else {
          sendQueue.push(payload);
        }
      });
    },
    wsEvents(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      return new Promise((resolve) => {
        if (ws.readyState === wsModule.WebSocket.CLOSED || ws.readyState === wsModule.WebSocket.CLOSING) {
          resolve();
          return;
        }
        ws.close();
        ws.once("close", () => resolve());
      });
    },
  };
}

interface PageSession {
  enableNetwork: () => Promise<void>;
  evalJs: (expression: string) => Promise<unknown>;
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

async function attachPage(cdp: ReturnType<typeof connectCdp>): Promise<PageSession> {
  const { targetInfos } = (await cdp.send("Target.getTargets")) as unknown as {
    targetInfos: Array<{ targetId: string; type: string }>;
  };
  const target = targetInfos.find((t) => t.type === "page");
  if (target === undefined) {
    throw new Error("no hay página en el Chrome headless");
  }
  const attach = (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true })) as unknown as {
    sessionId: string;
  };
  const sessionId = attach.sessionId;
  return {
    enableNetwork: async () => {
      await cdp.send("Network.enable", {}, sessionId);
    },
    send: (method, params = {}) => cdp.send(method, params, sessionId),
    evalJs: async (expression) => {
      const result = (await cdp.send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      )) as unknown as { exceptionDetails?: unknown; result?: { value: unknown } };
      if (result.exceptionDetails !== undefined) {
        throw new Error(`eval falló: ${JSON.stringify(result.exceptionDetails).slice(0, 500)}`);
      }
      return result.result?.value;
    },
  };
}

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

/** Rebuilda el CLI (web embebida + tsc) solo si el dist está viejo. */
async function ensureCliBuilt(): Promise<void> {
  const needed =
    !existsSync(distCli)
    || !existsSync(distWebIndex)
    || (statSync(distWebIndex).mtimeMs
      < Math.max(...[join(repoRoot, "packages", "web", "src"), join(repoRoot, "packages", "core", "src")].map(newestMtime)));
  if (!needed) {
    return;
  }
  const npmCmd = process.platform === "win32" ? "npm" : "npm";
  await new Promise<void>((resolve, reject) => {
    // shell: true — Node ≥ 20 bloquea spawn de .cmd sin shell (EINVAL).
    const build = spawn(npmCmd, ["run", "build", "-w", "@estela-dev/cli", "-w", "web"], { cwd: repoRoot, stdio: "pipe", shell: process.platform === "win32" });
    let out = "";
    build.stdout.on("data", (d) => (out += String(d)));
    build.stderr.on("data", (d) => (out += String(d)));
    build.on("error", reject);
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build fallo (${code}): ${out.slice(-1500)}`))));
  });
}

describe("estela e2e (Chrome headless)", {
  skip: chromePath === undefined,
}, () => {
  const workspace = mkdtempSync(join(tmpdir(), "estela-e2e-"));
  // Ruta de Windows con espacios (barras invertidas nativas de join en win32):
  // reproduce el reporte del bug con --log.
  const logDir = join(workspace, "mi carpeta");
  mkdirSync(logDir);
  const logFile = join(logDir, "mi aplicacion.log");
  // El CLI resuelve --log pero no crea el archivo: /api/tail devuelve
  // 404 log_unreadable hasta que exista. Como en uso real, existe desde el inicio.
  appendFileSync(logFile, "", "utf8");

  let cli: ChildProcess | undefined;
  let chrome: ChildProcess | undefined;
  let appUrl = "";
  let cdp: ReturnType<typeof connectCdp> | undefined;
  let page: PageSession | undefined;
    let tailEvents: Array<{ url: string; status: number }> = [];
    let pageErrors: Array<{ text: string; ts: number }> = [];
  let stopEvents: (() => void) | undefined;

  beforeAll(async () => {
    await ensureCliBuilt();
    // El CLI no acepta puerto 0 (valida 1..65535): puerto alto al azar.
    const port = 41000 + Math.floor(Math.random() * 20000);
    cli = spawn(process.execPath, [distCli, "--port", String(port), "--log", logFile, "--no-open"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: string[] = [];
    cli.stdout?.on("data", (d) => stdout.push(String(d)));
    cli.stderr?.on("data", (d) => stdout.push(`STDERR ${String(d)}`));
    for (let i = 0; i < 60 && appUrl === ""; i++) {
      await sleep(100);
      appUrl = stdout.join("").match(/http:\/\/localhost:\d+\/app/)?.[0] ?? "";
    }
    expect(appUrl).not.toBe("");
    // Da margen para que llegue la segunda línea del banner del CLI.
    await sleep(600);
    // La ruta con espacios la del CLI: 1 archivo de log reportado.
    expect(stdout.join("")).toContain("1 archivo(s) de log");

    chrome = spawn(
      chromePath as string,
      [
        "--headless=new",
        "--remote-debugging-port=0",
        `--user-data-dir=${join(workspace, "chrome-profile")}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--remote-allow-origins=*",
        "about:blank",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let wsUrl = "";
    chrome.stderr?.on("data", (d) => {
      wsUrl = wsUrl || String(d).match(/ws:\/\/[^\s]+/)?.[0] || "";
    });
    for (let i = 0; i < 60 && wsUrl === ""; i++) await sleep(100);
    expect(wsUrl).not.toBe("");

    cdp = connectCdp(wsUrl);
    page = await attachPage(cdp);
    await page.enableNetwork();
    await page.send("Runtime.enable");
    stopEvents = cdp.wsEvents((event) => {
      if (event.method === "Runtime.exceptionThrown") {
        const details = event.params.exceptionDetails as { exception?: { value?: unknown; description?: string }; text?: string } | undefined;
        pageErrors.push({
          text: details?.exception?.description ?? details?.text ?? JSON.stringify(details).slice(0, 200),
          ts: Date.now(),
        });
        return;
      }
      if (event.method !== "Network.responseReceived") {
        return;
      }
      const response = event.params.response as { url: string; status: number } | undefined;
      const origin = appUrl.replace(/\/app$/, "");
      if (response !== undefined && response.url.startsWith(`${origin}/api/tail`)) {
        tailEvents.push({ url: response.url, status: response.status });
      }
    });
  }, 90_000);

  afterAll(async () => {
    stopEvents?.();
    cli?.kill();
    chrome?.kill();
    await cdp?.close();
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch {
      // En Windows el perfil de Chrome puede retener la carpeta un momento.
    }
  });

  it("backend local hace polling a /api/tail (200) y pinta las líneas nuevas", { timeout: 60_000 }, async () => {
    // Navega a /app servida por el CLI (allí están los globals inyectados).
    await page!.evalJs(`location.href = ${JSON.stringify(appUrl)}; "goto"`);
    for (let i = 0; i < 40 && (await page!.evalJs(`location.pathname`)) !== "/app"; i++) {
      await sleep(250);
    }
    expect(await page!.evalJs(`location.pathname`)).toBe("/app");

    // Contexto de modo CLI inyectado en el HTML que sirve el CLI.
    const probe = JSON.parse(
      (await page!.evalJs(
        `Promise.resolve(JSON.stringify({
          token: window.__ESTELA_CLI_TOKEN__ ? "sí" : "no",
          logCount: window.__ESTELA_CLI_LOG_COUNT__,
        }))`,
      )) as string,
    ) as { token: string; logCount: number };
    expect(probe).toEqual({ token: "sí", logCount: 1 });

    // Selecciona explícitamente "Backend local" (como hace el usuario).
    await page!.evalJs(
      '(() => { const b=[...document.querySelectorAll("button")].find((e)=>e.textContent?.trim()==="Backend local"); if (b) b.click(); })()',
    );

    // Espera a que el polling esté vivo (indicate "En vivo" con 0 líneas: el
    // archivo está vacío y readFrom=end descarta lo preexistente).
    let label = "";
    let sawLive = false;
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      label =
        String(
          await page!.evalJs(
            '(() => { const s=[...document.querySelectorAll("span")].map((e)=>e.textContent??""); return s.find((t)=>/En vivo|Conectando|Detenido|Error/.test(t)) ?? "?"; })()',
          ),
        ) || "";
      if (label.includes("En vivo")) {
        sawLive = true;
        break;
      }
    }
    expect(sawLive, `label=${label}; errors=${JSON.stringify(pageErrors.slice(0, 4))}; tailOK=${JSON.stringify(tailEvents.slice(0, 4))}`).toBe(true);

    // Agrega una línea al archivo (ruta con espacios) mientras todo corre.
    const reqId = "req-e2e-f2b8";
    appendFileSync(logFile, `[2026-11-03T10:00:00.000Z] DEBUG GET /api/orders nueva línea req=${reqId}\n`, "utf8");

    // (b) la línea debe aparecer en el panel.
    let visible = false;
    for (let i = 0; i < 40 && !visible; i++) {
      await sleep(250);
      visible = (await page!.evalJs(`document.body.innerText.includes(${JSON.stringify(reqId)})`)) === true;
    }
    expect(visible).toBe(true);
    expect(label).toContain("En vivo");

    // (a) peticiones reales a /api/tail, todas con status 200.
    expect(tailEvents.length).toBeGreaterThan(0);
    for (const event of tailEvents) {
      expect(event.status).toBe(200);
    }

    // Lectura directa del tail con la ruta de Windows con espacios.
    const tailText = String(await page!.evalJs(
      `fetch("/api/tail?offset=0", { headers: { "X-Estela-Token": window.__ESTELA_CLI_TOKEN__ } }).then((r) => r.text())`,
    ));
    expect(tailText).toContain(reqId);
  });
});
