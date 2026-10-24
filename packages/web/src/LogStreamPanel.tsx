import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import {
  FileSystemLogSource,
  MockLogSource,
  PermissionRequiredError,
  RemoteLogSource,
  type LogLine,
} from "@devtool/core";
import { createOpfsDemoHandle, OpfsLogSimulator, pickLogFile } from "./lib/fs-bridge";
import { useCorrelationStore } from "./lib/correlation-store";
import { CLI_TOKEN_HEADER } from "./lib/cli-bridge";
import { getCliToken, isCliMode } from "./config";
import { CopyButton, EmptyState, LogLevelTag, MethodBadge, StatusBadge } from "./ui/primitives";

type SourceType = "mock" | "opfs-demo" | "file-picker" | "remote";

type ActiveSource = {
  name: string;
  stop: () => Promise<void>;
  unsubscribe: () => void;
};

type LogLineState = {
  lines: LogLine[];
  appendLines: (newLines: LogLine[]) => void;
  clearLines: () => void;
};

const useLogLineStore = create<LogLineState>((set) => ({
  lines: [],
  appendLines: (newLines) =>
    set((state) => ({ lines: [...state.lines, ...newLines].slice(-200) })),
  clearLines: () => set({ lines: [] }),
}));

const sourceLabels: Record<SourceType, string> = {
  mock: "Mock (en memoria)",
  "opfs-demo": "Simular backend (demo)",
  "file-picker": "Conectar archivo .log",
  remote: isCliMode() ? "CLI (tail local)" : "Backend remoto (tail)",
};

const sourceTooltips: Record<SourceType, string> = {
  mock: "Genera logs falsos en memoria para ver la correlación sin backend.",
  "opfs-demo": "Escribe a un .log virtual (OPFS) simulando un backend, y lo lee en vivo.",
  "file-picker": "Abre un .log real tuyo y lo sigue en vivo (File System Access API).",
  remote: isCliMode()
    ? "Hace tail de los archivos --log del CLI local (GET /api/tail)."
    : "Hace tail de /logs/tail de un backend que exponga esa ruta.",
};

const sourceGroups: Array<{ label: string; keys: SourceType[] }> = [
  { label: "Demo", keys: ["mock", "opfs-demo"] },
  { label: "Tus datos", keys: ["file-picker", "remote"] },
];

function formatTimestamp(timestamp: string | null): string {
  if (timestamp === null) {
    return "--:--:--";
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "--:--:--"
    : date.toLocaleTimeString([], { hour12: false });
}

export default function LogStreamPanel() {
  const lines = useLogLineStore((state) => state.lines);
  const appendLines = useLogLineStore((state) => state.appendLines);
  const clearLines = useLogLineStore((state) => state.clearLines);
  const activeSourceRef = useRef<ActiveSource | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceType>("mock");
  const [sourceName, setSourceName] = useState<string>("Sin origen activo");
  const [isRunning, setIsRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [remoteBase, setRemoteBase] = useState(() => localStorage.getItem("devtool.remoteBase") ?? "http://localhost:3000");
  const requests = useCorrelationStore((state) => state.requests);
  const selectedRequestId = useCorrelationStore((state) => state.selectedRequestId);
  const ingest = useCorrelationStore((state) => state.ingest);
  const selectRequest = useCorrelationStore((state) => state.selectRequest);
  const getCorrelation = useCorrelationStore((state) => state.getCorrelation);

  const stopActiveSource = useCallback(async (): Promise<void> => {
    const current = activeSourceRef.current;
    activeSourceRef.current = null;
    if (current === null) {
      return;
    }

    await current.stop();
    setIsRunning(false);
    setSourceName("Sin origen activo");
  }, []);

  useEffect(() => {
    return () => {
      void stopActiveSource();
    };
  }, [stopActiveSource]);

  useEffect(() => {
    const clockId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clockId);
  }, []);

  async function startSelectedSource(nextSource: SourceType): Promise<void> {
    await stopActiveSource();
    clearLines();
    setStopped(false);
    setPermissionError(null);
    setIsRunning(false);
    setConsecutiveErrors(0);

    const appendSourceLines = (newLines: LogLine[]): void => {
      if (newLines.length > 0) {
        setConsecutiveErrors(0);
      }
      ingest(newLines);
      appendLines(newLines);
    };

    try {
      if (nextSource === "mock") {
        const source = new MockLogSource("mock-log-source", "Mock log source", {
          requestIdProvider: () =>
            useCorrelationStore.getState().requests.map((request) => request.requestId).slice(0, 10),
        });
        const unsubscribe = source.subscribe(appendSourceLines);
        await source.start();
        activeSourceRef.current = {
          name: source.name,
          unsubscribe,
          stop: async () => {
            unsubscribe();
            await source.stop();
          },
        };
        setSourceName(source.name);
        setIsRunning(true);
        return;
      }

      if (nextSource === "opfs-demo") {
        const handle = await createOpfsDemoHandle();
        const simulator = new OpfsLogSimulator(handle, 400, {
          requestIdProvider: () => useCorrelationStore.getState().requests.map((r) => r.requestId).slice(-10),
        });
        const source = new FileSystemLogSource(handle, { readFrom: "end" });
        const unsubscribe = source.subscribe(appendSourceLines);
        await simulator.start();
        await source.start();
        activeSourceRef.current = {
          name: handle.name,
          unsubscribe,
          stop: async () => {
            unsubscribe();
            await source.stop();
            await simulator.stop();
          },
        };
        setSourceName(handle.name);
        setIsRunning(true);
        return;
      }

      if (nextSource === "remote") {
        const cliToken = getCliToken();
        let source;
        if (cliToken !== null) {
          // Modo CLI local: tail automático contra /api/tail con el token inyectado.
          source = new RemoteLogSource((offset) => `/api/tail?offset=${offset}`, {
            headers: { [CLI_TOKEN_HEADER]: cliToken },
            onError: () => setConsecutiveErrors((count) => count + 1),
          });
        } else {
          const base = remoteBase.trim().replace(/\/+$/, "");
          if (base === "") {
            throw new Error("Indica la base URL del backend remoto.");
          }
          source = new RemoteLogSource((offset) => `${base}/logs/tail?offset=${offset}`, {
            onError: () => setConsecutiveErrors((count) => count + 1),
          });
        }
        const unsubscribe = source.subscribe(appendSourceLines);
        await source.start();
        activeSourceRef.current = {
          name: source.name,
          unsubscribe,
          stop: async () => {
            unsubscribe();
            await source.stop();
          },
        };
        setSourceName(source.name);
        setIsRunning(true);
        return;
      }

      const handle = await pickLogFile();
      const source = new FileSystemLogSource(handle, { readFrom: "end" });
      const unsubscribe = source.subscribe(appendSourceLines);
      await source.start();
      activeSourceRef.current = {
        name: handle.name,
        unsubscribe,
        stop: async () => {
          unsubscribe();
          await source.stop();
        },
      };
      setSourceName(handle.name);
      setIsRunning(true);
    } catch (error) {
      if (error instanceof PermissionRequiredError) {
        setPermissionError("Permiso denegado, reintenta");
      } else if (error instanceof Error) {
        setPermissionError(error.message);
      }
      setSourceName("Sin origen activo");
    }
  }

  async function handleSourceChange(nextSource: SourceType): Promise<void> {
    setSelectedSource(nextSource);
    await startSelectedSource(nextSource);
  }

  async function handleStop(): Promise<void> {
    await stopActiveSource();
    setStopped(true);
  }

  function handleRemoteBaseChange(value: string): void {
    setRemoteBase(value);
    localStorage.setItem("devtool.remoteBase", value);
  }

  return (
    <section className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Log stream</h2>
          <p className="mt-1 text-sm text-slate-400">{lines.length} líneas en memoria</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-cyan-400 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={() => void startSelectedSource(selectedSource)}
            type="button"
          >
            {isRunning ? "En ejecución" : "Iniciar stream"}
          </button>
          {isRunning && !stopped && (
            <button
              className="rounded-md border border-slate-600 px-4 py-2 font-medium text-slate-200 transition-colors hover:border-red-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              onClick={() => void handleStop()}
              type="button"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {sourceGroups.map((group) => (
          <div key={group.label}>
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
              {group.label}
            </p>
            <div className="mt-1 inline-flex flex-wrap gap-1 rounded-lg bg-slate-800/60 p-1">
              {group.keys.map((key) => (
                <button
                  key={key}
                  className={`group relative rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
                    selectedSource === key
                      ? "bg-slate-700 text-cyan-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => {
                    void handleSourceChange(key);
                  }}
                  type="button"
                >
                  {sourceLabels[key]}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block group-focus-within:block">
                    {sourceTooltips[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedSource === "remote" && !isCliMode() && (
        <label className="mt-4 block text-sm text-slate-300">
          Base URL del backend
          <input
            className="mt-1 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            onChange={(event) => handleRemoteBaseChange(event.target.value)}
            placeholder="https://xxxx-3000.app.github.dev"
            type="url"
            value={remoteBase}
          />
        </label>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${isRunning ? consecutiveErrors >= 2 ? "bg-amber-400" : "bg-emerald-400" : "bg-red-400"}`} />
        <span className="text-slate-300">
          {consecutiveErrors >= 2 ? "reconectando…" : isRunning ? "En ejecución" : "Sin ejecución"}
          {sourceName !== "Sin origen activo" && ` · ${sourceName}`}
        </span>
      </div>

      {permissionError !== null && (
        <div className="mt-3 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {permissionError}
        </div>
      )}

      {lines.length === 0 ? (
        <div className="mt-5">
          <EmptyState message="Sin logs todavía — pulsa Iniciar stream" />
        </div>
      ) : (
      <ul className="no-scrollbar mt-5 max-h-[32rem] space-y-1 overflow-y-auto font-mono text-sm" aria-live="polite">
        {lines.map((line) => {
          const requestId = line.requestIds[0];
          return (
            <li
              className={`flex flex-wrap items-center gap-3 rounded px-3 py-2 ${requestId === undefined ? "bg-slate-950/40" : "bg-cyan-950/50"}`}
              key={line.id}
            >
              <time className="text-slate-500" dateTime={line.timestamp ?? undefined}>
                {formatTimestamp(line.timestamp)}
              </time>
              <LogLevelTag level={line.level} />
              <span className="min-w-0 flex-1 break-all text-slate-300">{line.raw}</span>
              {requestId !== undefined && (
                <CopyButton text={requestId} label={requestId} />
              )}
            </li>
          );
        })}
      </ul>
      )}

      <section className="mt-6 border-t border-slate-700 pt-5">
        <h3 className="text-lg font-semibold text-slate-100">Correlaciones</h3>
        <div className="mt-3 space-y-2">
          {requests.map((request) => {
            const isSelected = request.requestId === selectedRequestId;
            const correlation = isSelected ? getCorrelation(request.requestId) : null;
            const shortUrl = request.url.length > 64 ? `${request.url.slice(0, 61)}...` : request.url;
            const ageSeconds = Math.max(0, Math.floor((now - request.startedAt) / 1000));
            const age = ageSeconds < 60 ? `hace ${ageSeconds}s` : `hace ${Math.floor(ageSeconds / 60)}m`;
            const correlationLines = correlation === null
              ? []
              : [
                  ...correlation.contextBefore.map((line) => ({ line, kind: "context" })),
                  ...correlation.matchingLines.map((line) => ({ line, kind: "match" })),
                  ...correlation.contextAfter.map((line) => ({ line, kind: "context" })),
                ];

            return (
              <div key={request.requestId}>
                <button
                  className={`flex w-full flex-wrap items-center gap-3 rounded border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${isSelected ? "border-cyan-400 bg-cyan-950/50" : "border-slate-700 bg-slate-950/40 hover:border-slate-500"}`}
                  onClick={() => selectRequest(isSelected ? null : request.requestId)}
                  type="button"
                >
                  <MethodBadge method={request.method} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{shortUrl}</span>
                  {request.statusCode === null ? (
                    <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">-</span>
                  ) : (
                    <StatusBadge status={request.statusCode} />
                  )}
                  <span className="text-xs text-slate-500">{age}</span>
                </button>
                {isSelected && (
                  <div className="mt-2 space-y-1 border-l-2 border-cyan-400/40 pl-3 font-mono text-xs">
                    {correlationLines.length === 0 && (
                      <EmptyState message="Sin coincidencias aún — los logs pueden tardar unos segundos" />
                    )}
                    {correlationLines.map(({ line, kind }) => (
                      <div className={`flex gap-2 transition-colors ${kind === "context" ? "opacity-60" : "rounded bg-cyan-500/20 ring-1 ring-cyan-400/60"}`} key={line.id}>
                        <LogLevelTag level={line.level} />
                        <span className="break-all py-0.5 text-slate-300">{line.raw}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
