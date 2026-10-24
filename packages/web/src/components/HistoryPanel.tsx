import { useCorrelationStore } from "../lib/correlation-store";
import { trailColor } from "../lib/trail-colors";
import { methodColorClass } from "../lib/method-styles";
import { getHistory, type HistoryEntry } from "../lib/db";
import { useResponseStore } from "../lib/response-store";

function clockTime(startedAt: number): string {
  return new Date(startedAt).toLocaleTimeString([], { hour12: false });
}

function shortPath(url: string): string {
  if (url.length <= 42) {
    return url;
  }
  return `${url.slice(0, 40)}…`;
}

export default function HistoryPanel(): JSX.Element {
  const requests = useCorrelationStore((state) => state.requests);
  const selectedRequestId = useCorrelationStore((state) => state.selectedRequestId);
  const selectRequest = useCorrelationStore((state) => state.selectRequest);
  const getTrailColorIndex = useCorrelationStore((state) => state.getTrailColorIndex);
  const selectEntry = useResponseStore((state) => state.selectEntry);

  function handleClick(entry: typeof requests[number], wasSelected: boolean): void {
    selectRequest(wasSelected ? null : entry.requestId);
    if (wasSelected) {
      useResponseStore.getState().setResponse(null, null);
      return;
    }
    void (async () => {
      let history = await getHistory(entry.requestId).catch(() => undefined);
      if (history === undefined) {
        const stub: HistoryEntry = {
          requestId: entry.requestId,
          method: entry.method,
          url: entry.url,
          status: entry.statusCode ?? 0,
          durationMs: entry.durationMs ?? 0,
          startedAt: entry.startedAt,
        };
        history = stub;
      }
      selectEntry(history);
    })();
  }

  return (
    <div className="min-w-0 rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Historial</h2>
        <span className="text-[12px] text-dim">{requests.length} requests</span>
      </div>
      <ul className="mt-3 flex max-h-[530px] flex-col gap-1 overflow-y-auto no-scrollbar" aria-label="Historial de requests">
        {requests.map((request) => {
          const color = trailColor(getTrailColorIndex(request.requestId));
          const isSelected = request.requestId === selectedRequestId;
          const statusColor =
            request.statusCode === null
              ? "text-dim"
              : request.statusCode >= 400
                ? "text-err"
                : "text-ok";
          return (
            <li key={request.requestId}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`Editar request ${request.method} ${request.url}`}
                className={`min-h-[44px] w-full rounded-[10px] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isSelected ? "border bg-surface-2" : "border border-transparent hover:bg-surface-2/60"
                }`}
                style={isSelected ? { borderColor: color } : undefined}
                onClick={() => {
                  handleClick(request, isSelected);
                }}
                title={request.url}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className={`shrink-0 font-mono text-[11.5px] font-semibold ${methodColorClass(request.method)}`}>
                    {request.method.toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12.5px] text-code">{shortPath(request.url)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 pl-4 text-[11.5px] text-dim">
                  <span className={`font-semibold ${statusColor}`}>
                    {request.statusCode === null ? "…" : request.statusCode}
                  </span>
                  <span>{request.durationMs === null ? "—" : `${Math.round(request.durationMs)} ms`}</span>
                  <span className="ml-auto font-mono">{clockTime(request.startedAt)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {requests.length === 0 && (
        <p className="mt-2 rounded-[10px] border border-line px-3 py-4 text-sm text-ink-2">
          Aún no hay requests. Envía uno o activa la demo.
        </p>
      )}
    </div>
  );
}
