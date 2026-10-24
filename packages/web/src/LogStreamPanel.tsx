import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileSystemLogSource,
  PermissionRequiredError,
  RemoteLogSource,
  type LogLine,
} from "@devtool/core";
import { pickLogFile } from "./lib/fs-bridge";
import { useCorrelationStore } from "./lib/correlation-store";
import { useLogLineStore } from "./lib/log-buffer";
import { useSourceStore, type SourceId } from "./lib/source-state";
import { methodColorClass } from "./lib/method-styles";
import { CLI_TOKEN_HEADER } from "./lib/cli-bridge";
import { getCliToken, isCliMode } from "./config";
import { countByLevel, filterLines, levelFilterName, type LevelFilter } from "./lib/log-filter";
import { trailSpan } from "./lib/trail-gutter";
import { hexToRgba, trailColor, TRAIL_LINE_ALPHA } from "./lib/trail-colors";
import { DemoLogSource } from "./lib/demo-source";

const SOURCE_LABELS: Record<SourceId, string> = {
  demo: "Demo",
  file: "Archivo .log",
  remote: "Backend local",
};

function formatTimestamp(timestamp: string | null): string {
  if (timestamp === null) {
    return "--:--:--";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString([], { hour12: false });
}

const LEVEL_BADGES: Record<string, string> = {
  info: "text-info bg-[rgba(96,165,250,0.12)]",
  debug: "text-debug bg-[rgba(148,163,184,0.10)]",
  warn: "text-warn bg-[rgba(245,184,61,0.13)]",
  error: "text-err bg-[rgba(251,113,133,0.15)]",
};

const UNKNOWN_BADGE = "text-debug bg-[rgba(148,163,184,0.10)]";

export default function LogStreamPanel(): JSX.Element {
  const lines = useLogLineStore((state) => state.lines);
  const pending = useLogLineStore((state) => state.pending);
  const paused = useLogLineStore((state) => state.paused);
  const setPaused = useLogLineStore((state) => state.setPaused);
  const resume = useLogLineStore((state) => state.resume);
  const clearLines = useLogLineStore((state) => state.clearLines);

  const source = useSourceStore((state) => state.source);
  const setSource = useSourceStore((state) => state.setSource);
  const setRunning = useSourceStore((state) => state.setRunning);
  const [running, setLocalRunning] = useState(false);

  const selectedRequestId = useCorrelationStore((state) => state.selectedRequestId);
  const requests = useCorrelationStore((state) => state.requests);
  const buffer = useCorrelationStore((state) => state.buffer);
  const trailColors = useCorrelationStore((state) => state.trailColors);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [remoteBase, setRemoteBase] = useState<string>(() => {
    try {
      return localStorage.getItem("estela.remoteBase") ?? "http://localhost:3000";
    } catch {
      return "http://localhost:3000";
    }
  });
  const [level, setLevel] = useState<LevelFilter>("all");
  const [query, setQuery] = useState("");
  const [soloTrail, setSoloTrail] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newWhileScrolled, setNewWhileScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bootStarted = useRef(false);
  const sourceRef = useRef<{ unsubscribe: () => void; stop: () => Promise<void> } | null>(null);

  const stopActiveSource = useCallback(async (): Promise<void> => {
    const current = sourceRef.current;
    sourceRef.current = null;
    if (current === null) {
      return;
    }
    current.unsubscribe();
    await current.stop();
    setLocalRunning(false);
    setRunning(false);
  }, [setRunning]);

  useEffect(() => {
    return () => {
      void stopActiveSource();
    };
  }, [stopActiveSource]);

  const startSource = useCallback(
    async (nextSource: SourceId): Promise<void> => {
      await stopActiveSource();
      clearLines();
      setRunning(false);
      setPermissionError(null);
      setLocalRunning(false);

      const append = (newLines: LogLine[]): void => {
        if (newLines.length > 0) {
          useLogLineStore.getState().appendLines(newLines);
          useCorrelationStore.getState().ingest(newLines);
        }
      };

      try {
        if (nextSource === "demo") {
          const demo = new DemoLogSource("demo");
          const unsubscribe = demo.subscribe(append);
          await demo.start();
          sourceRef.current = {
            unsubscribe,
            stop: async () => {
              await demo.stop();
            },
          };
          setLocalRunning(true);
          setRunning(true);
          return;
        }
        if (nextSource === "remote") {
          const cliToken = getCliToken();
          let source_: RemoteLogSource;
          if (cliToken !== null) {
            // Backend local vía CLI: tail automático contra /api/tail.
            source_ = new RemoteLogSource((offset: number) => `/api/tail?offset=${offset}`, {
              headers: { [CLI_TOKEN_HEADER]: cliToken },
            });
          } else {
            const base = remoteBase.trim().replace(/\/+$/, "");
            if (base === "") {
              throw new Error("Indica la URL de tu backend local (http://localhost:…).");
            }
            source_ = new RemoteLogSource((offset: number) => `${base}/logs/tail?offset=${offset}`);
          }
          await source_.start();
          const unsubscribe = source_.subscribe(append);
          sourceRef.current = {
            unsubscribe,
            stop: () => source_.stop(),
          };
          setLocalRunning(true);
          setRunning(true);
          return;
        }
        // Archivo .log real del usuario
        const handle = await pickLogFile();
        const fileSource = new FileSystemLogSource(handle, { readFrom: "end" });
        const unsubscribe = fileSource.subscribe(append);
        await fileSource.start();
        sourceRef.current = {
          unsubscribe,
          stop: () => fileSource.stop(),
        };
        setLocalRunning(true);
        setRunning(true);
      } catch (error) {
        if (error instanceof PermissionRequiredError) {
          setPermissionError("Permiso denegado, reintenta");
        } else if (error instanceof Error) {
          setPermissionError(error.message);
        }
        // En caso de error, la fuente Demo queda disponible.
      }
    },
    [clearLines, remoteBase, setRunning, stopActiveSource],
  );

  // Primer arranque: demo automática fuera del modo CLI; en CLI arranca tail.
  useEffect(() => {
    if (bootStarted.current) {
      return;
    }
    bootStarted.current = true;
    setSource(isCliMode() ? "remote" : "demo");
    void startSource(isCliMode() ? "remote" : "demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTrailId = soloTrail && selectedRequestId !== null ? selectedRequestId : null;

  const visible = useMemo(() => {
    const base =
      visibleTrailId !== null
        ? buffer.filter((line) => line.requestIds.includes(visibleTrailId) || line.raw.includes(visibleTrailId))
        : filterLines(lines, { level, query });
    return base;
  }, [buffer, lines, level, query, visibleTrailId]);

  const counts = useMemo(() => countByLevel(lines), [lines]);

  // Autoscroll: solo si el usuario ya está abajo.
  useEffect(() => {
    if (atBottom && scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setNewWhileScrolled(true);
    }
  }, [visible.length, atBottom]);

  function handleScroll(): void {
    const el = scrollRef.current;
    if (el === null) {
      return;
    }
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    setAtBottom(bottom);
    if (bottom) {
      setNewWhileScrolled(false);
    }
  }

  function goBottomAndFollow(): void {
    setAtBottom(true);
    setNewWhileScrolled(false);
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  function togglePause(): void {
    if (paused) {
      resume();
      return;
    }
    setPaused(true);
  }

  function handleRemoteBaseChange(value: string): void {
    setRemoteBase(value);
    try {
      localStorage.setItem("estela.remoteBase", value);
    } catch {
      // storage bloqueado: se queda solo en memoria
    }
  }

  // ---- Barra de rastro ----
  const selectedRequest = requests.find((r) => r.requestId === selectedRequestId) ?? null;
  const trailLines =
    selectedRequestId === null
      ? []
      : buffer.filter(
          (line) => line.requestIds.includes(selectedRequestId) || line.raw.includes(selectedRequestId),
        );
  const trailErrors = trailLines.filter((l) => l.level === "error").length;
  const trailWarns = trailLines.filter((l) => l.level === "warn").length;
  const trailDuration =
    selectedRequest?.durationMs ??
    (trailLines.length >= 2 &&
    trailLines[0]?.timestamp !== null &&
    trailLines[trailLines.length - 1]?.timestamp !== null
      ? Math.max(
          0,
          new Date(trailLines[trailLines.length - 1].timestamp ?? 0).getTime() -
            new Date(trailLines[0].timestamp ?? 0).getTime(),
        )
      : null);

  const liveCount = lines.length + pending.length;

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[14px] border border-line bg-surface p-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[18px] font-bold text-ink">Logs en vivo</h2>
        <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${running && !paused ? "bg-ok animate-live-pulse" : "bg-dim"}`}
          />
          {running ? (paused ? "En pausa" : `En vivo · ${liveCount} líneas`) : "Detenido"}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-[10px] border border-line bg-bg p-[3px]" role="group" aria-label="Fuente de logs">
            {(Object.keys(SOURCE_LABELS) as SourceId[]).map((id) => {
              const isActive = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isActive}
                  className={`min-h-[32px] rounded-[8px] px-3 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    isActive ? "bg-elevated font-semibold text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                  onClick={() => {
                    setSource(id);
                    void startSource(id);
                  }}
                >
                  {SOURCE_LABELS[id]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={paused}
            className="min-h-[32px] rounded-[10px] border border-line px-3 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={togglePause}
          >
            {paused ? "Reanudar" : "Pausar"}
          </button>
        </span>
      </div>

      {source === "remote" && !isCliMode() && (
        <div className="flex items-center gap-2">
          <label htmlFor="remote-base" className="sr-only">
            URL del backend local
          </label>
          <input
            id="remote-base"
            className="h-[36px] min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-3 font-mono text-[12.5px] text-code outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            value={remoteBase}
            onChange={(event) => handleRemoteBaseChange(event.target.value)}
            placeholder="http://localhost:3000"
            spellCheck={false}
          />
          <button
            type="button"
            className="min-h-[36px] rounded-[10px] border border-line px-3 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={() => void startSource("remote")}
          >
            Reconectar
          </button>
        </div>
      )}

      {permissionError !== null && (
        <div className="rounded-[10px] border border-err/50 bg-[rgba(251,113,133,0.10)] px-3 py-2 text-[12.5px] text-err">
          {permissionError}
        </div>
      )}

      {/* Barra de rastro */}
      {selectedRequest !== null &&
        (() => {
          const color = trailColor(trailColors[selectedRequest.requestId] ?? 0);
          const tint = hexToRgba(color, 0.1);
          return (
            <div
              className="flex flex-wrap items-center gap-3 rounded-[12px] border px-3 py-2.5"
              style={{ borderColor: color, backgroundColor: tint }}
            >
              <span
                aria-hidden="true"
                className="block h-[10px] w-[10px] rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${hexToRgba(color, 0.8)}` }}
              />
              <span className="font-mono text-[12.5px] text-ink">
                Rastro de{" "}
                <span className={`font-semibold ${methodColorClass(selectedRequest.method)}`}>
                  {selectedRequest.method.toUpperCase()}
                </span>{" "}
                {selectedRequest.url.replace(/^https?:\/\/[^/]+/, "")}
              </span>
              <span className="basis-full text-[12.5px] text-ink-2 sm:basis-auto">
                {trailLines.length} líneas ·{" "}
                {trailErrors === 0 ? "sin errores" : `${trailErrors} error(es)`} · {trailWarns} aviso(s) ·{" "}
                {trailDuration === null ? "—" : `${Math.round(trailDuration)} ms de principio a fin`}
              </span>
              <button
                type="button"
                aria-pressed={soloTrail}
                className="ml-auto min-h-[32px] rounded-[10px] border border-line-strong bg-elevated px-3 text-[12px] text-ink transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                onClick={() => setSoloTrail(!soloTrail)}
              >
                {soloTrail ? "Ver todos los logs" : "Solo este rastro"}
              </button>
            </div>
          );
        })()}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="log-search" className="sr-only">
          Buscar en los logs
        </label>
        <input
          id="log-search"
          className="h-[36px] min-w-[180px] flex-1 rounded-[10px] border border-line bg-bg px-3 text-[12.5px] text-code outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en los logs…"
          type="search"
        />
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtro por nivel">
          {(["all", "info", "warn", "error", "debug"] as LevelFilter[]).map((lvl) => {
            const isActive = level === lvl;
            const chipCount = lvl === "all" ? counts.all : counts[lvl];
            const colorClass =
              lvl === "all"
                ? "text-ink-2"
                : (LEVEL_BADGES[lvl]?.split(" ")[0] ?? "text-ink-2");
            return (
              <button
                key={lvl}
                type="button"
                aria-pressed={isActive}
                className={`min-h-[32px] rounded-full border px-3 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isActive ? "border-line-strong bg-elevated text-ink" : "border-line bg-bg text-ink-2 hover:text-ink"
                }`}
                onClick={() => setLevel(lvl)}
              >
                <span className={colorClass}>{levelFilterName(lvl)}</span> <span className="text-dim">{chipCount}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="relative">
        {lines.length === 0 ? (
          <div className="min-h-[160px] rounded-[10px] border border-line bg-bg px-3 py-6 text-center text-[12.5px] text-dim">
            Sin logs todavía — elige una fuente.
          </div>
        ) : visible.length === 0 ? (
          <div className="min-h-[160px] rounded-[10px] border border-line bg-bg px-3 py-6 text-center text-[12.5px] text-dim">
            Ninguna línea coincide con el filtro.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] bg-bg">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-[520px] overflow-x-hidden overflow-y-auto px-2 py-2 sm:px-3"
              role="log"
              aria-label="Lista de logs"
            >
              {(() => {
                const memberships = visible.map(
                  (line) => selectedRequestId !== null && (line.requestIds.includes(selectedRequestId) || line.raw.includes(selectedRequestId)),
                );
                const spanIdx: { first: number; last: number } | null = trailSpan(memberships);
                return visible.map((line, i) => {
                  const isTrail = memberships[i];
                  const trailColorValue =
                    isTrail && selectedRequestId !== null
                      ? trailColor(trailColors[selectedRequestId] ?? 0)
                      : null;
                  const id = line.requestIds[0];
                  const requestIdColor =
                    id !== undefined && trailColors[id] !== undefined
                      ? trailColor(trailColors[id])
                      : null;
                  const inSpan = spanIdx !== null && i >= spanIdx.first && i <= spanIdx.last;
                  return (
                    <div
                      key={line.id}
                      className="grid grid-cols-[22px_104px_62px_minmax(0,1fr)_84px] items-baseline gap-[10px] px-1 py-[3px] max-sm:grid-cols-[20px_54px_minmax(0,1fr)]"
                      style={isTrail && trailColorValue !== null ? { backgroundColor: hexToRgba(trailColorValue, 0.09) } : undefined}
                    >
                      <span className="relative block h-[19px]">
                        {isTrail && trailColorValue !== null && (
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{ backgroundColor: trailColorValue, boxShadow: "0 0 0 3px #070A12" }}
                          />
                        )}
                        {inSpan && trailColorValue !== null && spanIdx !== null && (
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 w-[2px] -translate-x-1/2"
                            style={{
                              backgroundColor: hexToRgba(trailColorValue, TRAIL_LINE_ALPHA),
                              top: i === spanIdx.first ? "50%" : 0,
                              bottom: i === spanIdx.last ? "50%" : 0,
                            }}
                          />
                        )}
                      </span>
                      <time className="font-mono text-[11.5px] text-dim max-sm:hidden" dateTime={line.timestamp ?? undefined}>
                        {formatTimestamp(line.timestamp)}
                      </time>
                      <span
                        className={`justify-center rounded-[5px] px-1.5 py-0.5 text-center text-[11px] font-semibold ${LEVEL_BADGES[line.level] ?? UNKNOWN_BADGE}`}
                      >
                        {line.level.toUpperCase()}
                      </span>
                      <span
                        className={`min-w-0 text-[12.5px] leading-[1.7] ${isTrail ? "text-[#F1F4F9]" : "text-code"}`}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {line.raw.replace(/^\[[^\]]+\]\s*/, "")}
                      </span>
                      <span
                        className="text-right font-mono text-[11.5px] max-sm:hidden"
                        style={{ color: requestIdColor ?? undefined }}
                        title={id !== undefined ? `request ${id}` : undefined}
                      >
                        {id === undefined ? <span className="text-dim">—</span> : id.slice(0, 8)}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        {!atBottom && newWhileScrolled && visible.length > 0 && (
          <button
            type="button"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line-strong bg-elevated px-4 py-2 text-[12px] text-ink shadow-lg transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={goBottomAndFollow}
          >
            Nuevas líneas ↓
          </button>
        )}
      </div>
    </section>
  );
}
