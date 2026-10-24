import { useEffect, useState, useSyncExternalStore } from "react";
import { MethodBadge, StatusBadge } from "../ui/primitives";

/* Animación en bucle (~6 s): aparece el request GET /api/users, caen 6 líneas
   de log una por una y las líneas correlacionadas con ese request llevan un
   punto cian unido por una línea vertical ("el rastro").
   Con prefers-reduced-motion se muestra el estado final sin animar. */

const STEP_MS = 650;

interface DemoLog {
  level: "DEBUG" | "INFO" | "WARN";
  text: string;
  corr: boolean;
}

const DEMO_LOGS: readonly DemoLog[] = [
  { level: "DEBUG", text: "rollup cache warm (3ms)", corr: false },
  { level: "INFO", text: "GET /api/users → 200 (12ms) id=req_8f3a", corr: true },
  { level: "DEBUG", text: "SELECT * FROM users LIMIT 20", corr: true },
  { level: "WARN", text: "query lenta detectada (900ms)", corr: false },
  { level: "INFO", text: "GET /api/users → 200 (7ms) id=req_8f3a", corr: true },
  { level: "DEBUG", text: "GC minor pass (1ms)", corr: false },
];

/* 1 tick = request, 6 ticks = logs, 2 ticks = pausa antes del reinicio. */
const CYCLE = 1 + DEMO_LOGS.length + 2;

const REQUEST_URL = "http://localhost:3000/api/users";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
  };
}

export default function HeroDemo(): JSX.Element {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) {
      return;
    }
    const timer = window.setInterval(() => {
      setTick((t) => (t + 1) % CYCLE);
    }, STEP_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [reduced]);

  const now = reduced ? CYCLE - 1 : tick;
  const requestVisible = now >= 1;
  const visible = Math.min(Math.max(now - 1, 0), DEMO_LOGS.length);
  const logs = DEMO_LOGS.slice(0, visible);
  const firstCorr = logs.findIndex((l) => l.corr);
  const lastCorr = logs.reduce((acc, l, i) => (l.corr ? i : acc), -1);

  return (
    <div className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">request ↔ logs en vivo</h2>
        <span className="rounded-full border border-slate-600 px-3 py-1 font-mono text-xs text-slate-400">
          loop · {visible}/{DEMO_LOGS.length} líneas
        </span>
      </div>
      <div className="mt-4 min-h-[16rem] font-mono text-xs">
        {requestVisible && (
          <div className="demo-enter flex flex-wrap items-center gap-2" aria-hidden="true">
            <MethodBadge method="GET" />
            <span className="min-w-0 truncate font-mono text-sm text-slate-300">{REQUEST_URL}</span>
            <StatusBadge status={200} detail="OK" />
          </div>
        )}
        <div className="mt-2">
          {logs.map((log, i) => {
            const showLine = i >= firstCorr && i <= lastCorr;
            return (
              <div key={i} className="demo-enter flex items-start gap-2">
                <span className="relative block w-4 shrink-0 self-stretch" aria-hidden="true">
                  {showLine && (
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded bg-cyan-400/50" />
                  )}
                  {log.corr && (
                    <span className="absolute left-1/2 top-[10px] h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgb(34_211_238/0.7)]" />
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 ${
                    log.corr
                      ? "bg-cyan-500/10 text-slate-200 ring-1 ring-cyan-400/40"
                      : "text-slate-500"
                  }`}
                >
                  {log.level} {log.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only">
        Vista teatral: un request a GET /api/users y las líneas de log asociadas
        aparecen en bucle, marcadas con un punto cian conectado por el rastro.
      </p>
    </div>
  );
}
