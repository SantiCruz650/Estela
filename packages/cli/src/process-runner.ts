/* Proceso hijo (modo proceso del CLI): Estela arranca el comando del
   usuario, captura stdout/stderr con hora exacta por línea, muestra la
   salida original en la terminal y al cerrarse (Ctrl+C) mata el ÁRBOL
   completo del hijo (taskkill /T /F en Windows, grupo de procesos en Unix).
   El pegamento Node vive aquí; lo puro (decodificación, buffer) está en core. */
import { spawn, type ChildProcess } from "node:child_process";
import { stdout as out, stderr as err } from "node:process";
import {
  createProcessOutputHandler,
  ProcessLogBuffer,
  processChildEnv,
  processCommandLabel,
  spawnPlanForCommand,
  type ProcessStreamName,
} from "@devtool/core";

export interface ProcessRun {
  /** Comando para la UI ("npm run dev"). */
  readonly commandLabel: string;
  readonly buffer: ProcessLogBuffer;
  /** Mata el árbol del hijo. fireplace libera puertos y reinicia SIGINT. */
  dispose: () => void;
  /** Se dispara UNA vez con el código del hijo (null si lo matamos, hard). */
  onExit: (callback: (code: number | null) => void) => void;
}

/** taskkill /pid <pid> /T /F — árbol completo (hijo + subprocesos) en Windows. */
function killTreeWindows(pid: number): void {
  spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
}

export function spawnProcess(commandTokens: readonly string[]): ProcessRun {
  const plan = spawnPlanForCommand(commandTokens, process.platform);
  const commandLabel = processCommandLabel(commandTokens);
  const buffer = new ProcessLogBuffer();

  const exitListeners = new Set<(code: number | null) => void>();
  let disposed = false;

  const useShell = plan.useShell && plan.commandString !== null;
  const child: ChildProcess = useShell
    ? spawn(plan.commandString ?? commandLabel, {
        shell: true,
        env: { ...process.env, ...processChildEnv() },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      })
    : spawn(plan.argv?.[0] ?? "", (plan.argv ?? []).slice(1), {
        // detached + kill(-pid) para matar TODO el grupo en macOS/Linux.
        detached: true,
        env: { ...process.env, ...processChildEnv() },
        stdio: ["ignore", "pipe", "pipe"],
      });

  const handler = createProcessOutputHandler({
    now: () => Date.now(),
    // Echo original en la terminal: el usuario sigue viendo sus logs intactos.
    onDecoded: (stream, text) => {
      (stream === "stdout" ? out : err).write(text);
    },
    onLine: (entry) => {
      buffer.append(entry.t, entry.text, entry.stream);
    },
  });

  child.stdout?.on("data", (chunk: Buffer) => handler.onData("stdout", chunk));
  child.stderr?.on("data", (chunk: Buffer) => handler.onData("stderr", chunk));

  child.on("close", (code: number | null) => {
    handler.end("stdout");
    handler.end("stderr");
    if (!disposed) {
      // Solo anunciamos salida natural: un kill del usuario ya liberó puertos.
      buffer.setExited(code);
    }
    for (const listener of exitListeners) {
      listener(code);
    }
  });

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    const pid = child.pid;
    if (process.platform === "win32") {
      if (pid !== undefined) {
        killTreeWindows(pid);
      }
    } else if (pid !== undefined) {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
    // Sin código de salida normal: fue nosotros.
    buffer.setExited(null);
  }

  return {
    commandLabel,
    buffer,
    dispose,
    onExit: (callback) => {
      exitListeners.add(callback);
    },
  };
}

export type { ProcessStreamName };
