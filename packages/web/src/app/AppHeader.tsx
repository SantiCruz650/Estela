import type { ExtensionStatus } from "../hooks/useExtensionStatus";
import { isCliMode, REPO_URL } from "../config";
import { connectionView } from "../lib/connection";
import { useLogLineStore } from "../lib/log-buffer";
import { useSourceStore } from "../lib/source-state";

export default function AppHeader({ extStatus }: { extStatus: ExtensionStatus }): JSX.Element {
  const source = useSourceStore((state) => state.source);
  const running = useSourceStore((state) => state.running);
  const lines = useLogLineStore((state) => state.lines);
  const pending = useLogLineStore((state) => state.pending);
  const statusText = isCliMode() ? `127.0.0.1:${window.location.port || "80"}` : "";
  const view = connectionView(source, running, extStatus, statusText);

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-full flex-wrap items-center gap-x-3 gap-y-2 px-[16px] py-3 lg:px-7">
        <span className="flex min-w-0 items-center gap-2">
          <img src="/estela.svg" alt="Logo de Estela" className="h-6 w-6 shrink-0" />
          <span className="text-[18px] font-bold text-ink">Estela</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] leading-none text-dim">beta</span>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Indicador único de conexión */}
          <span
            className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-line bg-surface px-3 py-1"
            title={view.label}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${view.dotClass}`} />
            <span className="text-[12.5px] font-semibold text-ink">{view.label}</span>
            <span className="hidden font-mono text-[12px] text-dim sm:inline">{view.detail}</span>
          </span>
          <span className="hidden font-mono text-[12px] text-dim md:inline" title="Atajo del formulario">
            Ctrl + Enter envía
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[32px] px-1 py-1 text-[13px] font-medium text-ink-2 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            GitHub
          </a>
        </span>
      </div>
      {/* El contador de líneas vive aquí para feed del indicador (tests de pausa en log-buffer). */}
      <span className="sr-only">{lines.length + pending.length} líneas de log en memoria</span>
    </header>
  );
}
