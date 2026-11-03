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
import { existsSync, mkdtempSync, mkdirSync, appendFileSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import * as wsModule from "ws";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

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

  it("al enviar desde la app: auto-selección, rastro (rellenos + hueco) y mensaje limpio", { timeout: 90_000 }, async () => {
    const errorsBefore = pageErrors.length;
    // Backend REAL mínimo (estilo Next.js): logea 2 líneas seguras (req=<id>
    // al entrar y al salir) + 1 línea de framework sin id, responde tras ~200 ms.
    const backend = http.createServer((req, res) => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "content-type,x-request-id");
      res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const id = String(req.headers["x-request-id"] ?? "sin-id");
        const timestamp = new Date().toISOString();
        appendFileSync(logFile, `${timestamp} INFO req=${id} → GET /api/me\n`, "utf8");
        // Línea de framework SIN id y SIN token de nivel de Estela: nivel
        // desconocido → badge "—", y es probable por timestamp dentro de la ventana.
        appendFileSync(logFile, `${timestamp} GET /api/me 200 in 33ms (route.ts interno, sin id)\n`, "utf8");
        setTimeout(() => {
          appendFileSync(logFile, `${new Date().toISOString()} INFO req=${id} ← 200 GET /api/me 33ms\n`, "utf8");
          res.writeHead(200, { "content-type": "application/json", "x-request-id": id });
          res.end(JSON.stringify({ ok: true, requestId: id }));
        }, 200);
      });
    });
    await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
    const backendPort = (backend.address() as AddressInfo).port;
    try {
      // Enviar desde la UI real: URL mock + botón Enviar.
      const fill = String(
        await page!.evalJs(`(() => {
          const input = document.querySelector("#req-url");
          if (input === null) return "no-url-input";
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(input, ${JSON.stringify(`http://127.0.0.1:${backendPort}/api/me`)});
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return "ok";
        })()`),
      );
      expect(fill).toBe("ok");
      const sendClicked = String(
        await page!.evalJs(
          '(() => { const b=[...document.querySelectorAll("button")].find((e)=>e.textContent?.trim()==="Enviar"); if (b===undefined) return "no"; b.click(); return "ok"; })()',
        ),
      );
      expect(sendClicked).toBe("ok");

      // A) AUTO-SELECCIÓN: el rastro aparece SIN que el usuario toque el historial.
      let selected = "";
      let trailBar = "";
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        const state = JSON.parse(
          String(await page!.evalJs(`JSON.stringify({
            historyPressed: [...document.querySelectorAll("li button[aria-pressed='true']")].length,
            trail: (document.body.innerText.match(/Rastro de[^\\n]*/g) ?? [])[0] ?? "",
          })`)),
        ) as { historyPressed: number; trail: string };
        selected = String(state.historyPressed);
        trailBar = state.trail;
        if (state.historyPressed > 0 && state.trail.includes("Rastro de")) break;
      }
      if (selected === "0") {
        const diagnosis = String(
          await page!.evalJs(`JSON.stringify({
            liveLabel: ([...document.querySelectorAll("span")].map((e) => e.textContent ?? "").find((t) => /En vivo|Conectando|Detenido|Error de/.test(t)) ?? "?"),
            logRows: document.querySelectorAll('[role="log"] > div').length,
            bodyTail: document.body.innerText.slice(-400),
          })`),
        );
        console.warn("DIAGNOSTICO sin auto-selección:", diagnosis, "| log actual:", readFileSync(logFile, "utf8"));
      }
      expect(
        selected,
        `sin auto-selección: ${selected} item(s) activos; errors=${JSON.stringify(pageErrors.slice(0, 3))}`,
      ).not.toBe("0");
      expect(trailBar).toContain("Rastro de GET /api/me");

      // B) Espera a que las 3 líneas del backend lleguen por el tail y encontrar filas.
      let rowsFound = false;
      for (let i = 0; i < 40 && !rowsFound; i++) {
        await sleep(250);
        rowsFound =
          String(
            await page!.evalJs(
              '(() => { const t=[...document.querySelectorAll(\'[role="log"] > div\')].map((r)=>r.textContent??"").join("\\n"); return t.includes("← 200 GET /api/me 33ms") && t.includes("route.ts interno"); })()',
            ),
          ) === "true";
      }
      expect(rowsFound, "las 3 líneas no aparecieron en el panel").toBe(true);
      // Filas del panel: mensaje limpio, badge sin "UNKNOWN" y puntos correctos.
      const rows = JSON.parse(
        String(await page!.evalJs(`JSON.stringify((() => {
          const rows = [...document.querySelectorAll('[role="log"] > div')];
          return rows.map((r) => {
            const cell = r.children[0];
            const dot = cell !== undefined ? cell.querySelector("span[style]") : null;
            const cells = [...r.children].map((c) => c.textContent?.trim() ?? "");
            return {
              badge: cells[2] ?? "",
              text: cells[3] ?? "",
              id: cells[4] ?? "",
              dot: dot === null ? "" : (dot.getAttribute("style") ?? ""),
              rowBg: (r.getAttribute("style") ?? "").includes("background-color") ? "colored" : "plain",
            };
          });
        })())`)),
      ) as Array<{ badge: string; text: string; id: string; dot: string; rowBg: string }>;
      const withText = (needle: string) => rows.filter((r) => r.text.includes(needle));

      // Mensaje LIMPIO: sin ISO, sin nivel, sin req=<id> (en cualquier posición).
      const entry = withText("→ GET /api/me");
      const exit = withText("← 200 GET /api/me 33ms");
      const framework = withText("route.ts interno");
      expect(entry).toHaveLength(1);
      expect(exit).toHaveLength(1);
      expect(framework).toHaveLength(1);
      expect(entry[0].text).toBe("→ GET /api/me");
      expect(entry[0].text).not.toContain("req=");
      expect(entry[0].text).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry[0].id).not.toBe("");

      // C) Badge de nivel: INFO normal, desconocido = "—" (nunca "UNKNOWN").
      expect(entry[0].badge).toContain("INFO");
      expect(framework[0].badge).toBe("—");
      const unknownCount = Number(
        await page!.evalJs(
          '[...document.querySelectorAll("span")].filter((s) => s.textContent === "UNKNOWN").length',
        ),
      );
      expect(unknownCount).toBe(0);

      // D) Puntos del rastro: relleno en las seguras, hueco en la probable.
      const isFilled = (dot: string) =>
        dot.includes("background-color") && !dot.includes("transparent");
      const isHollow = (dot: string) => dot.includes("border: 2px") && dot.includes("transparent");
      expect(isFilled(entry[0].dot), `entry dot: ${entry[0].dot}`).toBe(true);
      expect(isFilled(exit[0].dot), `exit dot: ${exit[0].dot}`).toBe(true);
      expect(isHollow(framework[0].dot), `framework dot: ${framework[0].dot}`).toBe(true);
      // Y la fila entera toma el color del rastro.
      expect(entry[0].rowBg).toBe("colored");
      expect(framework[0].rowBg).toBe("colored");

      expect(pageErrors.length, JSON.stringify(pageErrors.slice(errorsBefore, 3))).toBe(errorsBefore);
    } finally {
      backend.closeAllConnections?.();
      await new Promise<void>((resolve) => backend.close(() => resolve()));
    }
  });
});
