import HistoryPanel from "../components/HistoryPanel";
import { EXTENSION_INSTALL_URL } from "../config";
import SiteFooter from "../legal/SiteFooter";
import LogStreamPanel from "../LogStreamPanel";
import RequestRunner from "../RequestRunner";
import { useExtensionStatus } from "../hooks/useExtensionStatus";
import { ExtensionIndicator } from "../ui/primitives";

export default function DashboardLayout(): JSX.Element {
  const extStatus = useExtensionStatus();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight text-slate-100">
            Estela
          </span>
          <ExtensionIndicator state={extStatus} installHref={EXTENSION_INSTALL_URL} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
          <div className="min-h-0 space-y-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
              01 · Request → Response
            </p>
            <RequestRunner extStatus={extStatus} />
            <details className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <summary className="cursor-pointer rounded text-sm font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
                Historial
              </summary>
              <div className="mt-3">
                <HistoryPanel />
              </div>
            </details>
          </div>

          <div className="min-h-0 space-y-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
              02 · Logs en vivo
            </p>
            <LogStreamPanel />
          </div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}
