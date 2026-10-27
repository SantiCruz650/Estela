import { useEffect, useRef, useState } from "react";import type { HttpRequestInput } from "@devtool/core";
import { methodColorClass } from "../lib/method-styles";
import { newRequestId } from "../lib/request-id";
import { useResponseStore } from "../lib/response-store";

type RequestFormProps = {
  onSend: (input: HttpRequestInput) => void;
  onCancel: () => void;
  sending: boolean;
};

export interface RequestDefaults {
  method: string;
  url: string;
  body: string;
  headers: Array<{ key: string; value: string }>;
  nonce: number;
}

type HeaderRow = {
  id: string;
  key: string;
  value: string;
};

const STORAGE_URL_KEY = "estela.requestUrl";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const CONTROLS_HEIGHT = "h-[44px]";
const NO_BODY_METHODS = new Set(["GET", "HEAD"]);

let rowIdCounter = 0;
function nextRowId(): string {
  rowIdCounter += 1;
  return `hdr-${rowIdCounter}`;
}

export default function RequestForm({ onSend, onCancel, sending }: RequestFormProps): JSX.Element {
  const [method, setMethod] = useState<string>("GET");
  const [url, setUrl] = useState<string>(() => localStorage.getItem(STORAGE_URL_KEY) ?? "http://localhost:3000/api/users");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([{ id: nextRowId(), key: "", value: "" }]);
  const [body, setBody] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"headers" | "body">("headers");
  const selection = useResponseStore((state) => state.selection);
  const lastAppliedNonce = useRef(selection?.nonce ?? 0);

  // Carga desde historial: método, URL, headers y body vuelven al formulario.
  useEffect(() => {
    if (selection === null || selection.nonce === lastAppliedNonce.current) {
      return;
    }
    lastAppliedNonce.current = selection.nonce;
    const { entry } = selection;
    setMethod(entry.method.toUpperCase());
    setUrl(entry.url);
    const rows: HeaderRow[] = Object.entries(entry.requestHeaders ?? {})
      .filter(([key]) => key.toLowerCase() !== "x-request-id")
      .map(([key, value]) => ({ id: nextRowId(), key, value }));
    setHeaderRows(rows.length > 0 ? rows : [{ id: nextRowId(), key: "", value: "" }]);
    setBody(entry.requestBody ?? "");
  }, [selection]);

  const noBody = NO_BODY_METHODS.has(method.toUpperCase());
  const customRequestId = headerRows.find((row) => row.key.trim().toLowerCase() === "x-request-id")?.value.trim();

  function addHeaderRow(): void {
    setHeaderRows((rows) => [...rows, { id: nextRowId(), key: "", value: "" }]);
  }

  function removeHeaderRow(id: string): void {
    setHeaderRows((rows) => {
      const rest = rows.filter((row) => row.id !== id);
      return rest.length > 0 ? rest : [{ id: nextRowId(), key: "", value: "" }];
    });
  }

  function updateHeaderRow(id: string, patch: Partial<HeaderRow>): void {
    setHeaderRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function send(): void {
    if (url.trim() === "") {
      return;
    }
    const headers: Record<string, string> = {};
    for (const row of headerRows) {
      if (row.key.trim() !== "") {
        headers[row.key.trim()] = row.value;
      }
    }
    onSend({
      method: method.toUpperCase(),
      url,
      headers,
      body: noBody ? undefined : body === "" ? undefined : body,
      requestId: customRequestId !== undefined && customRequestId !== "" ? customRequestId : newRequestId(),
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !sending) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div onKeyDown={handleKeyDown} className="flex flex-col gap-3">
      {/* Fila de controles */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[130px] flex-col gap-1">
          <label htmlFor="req-method" className="sr-only">
            Método HTTP
          </label>
          <select
            id="req-method"
            className={`${CONTROLS_HEIGHT} w-full rounded-[10px] border border-line bg-bg px-3 font-mono text-[13px] font-semibold ${methodColorClass(method)} outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m} className={methodColorClass(m)}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="req-url" className="sr-only">
            URL del request
          </label>
          <input
            id="req-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className={`${CONTROLS_HEIGHT} min-w-0 rounded-[10px] border border-line bg-bg px-3 font-mono text-[13.5px] text-code outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              localStorage.setItem(STORAGE_URL_KEY, event.target.value);
            }}
            placeholder="http://localhost:3000/…"
          />
        </div>
        <button
          type="button"
          title="Ctrl + Enter"
          aria-keyshortcuts="Control+Enter"
          className={`${CONTROLS_HEIGHT} shrink-0 rounded-[10px] bg-accent px-5 font-semibold text-accent-ink transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50`}
          onClick={send}
          disabled={sending || url.trim() === ""}
        >
          Enviar
        </button>
        {sending && (
          <button
            type="button"
            className={`${CONTROLS_HEIGHT} shrink-0 rounded-[10px] border border-err/60 px-4 font-medium text-err transition-colors hover:bg-err/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Pestañas Headers/Body */}
      <div className="flex items-baseline gap-5 border-b border-line" role="tablist" aria-label="Secciones del request">
        {(["headers", "body"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-pressed={isActive}
              aria-selected={isActive}
              className={`-mb-px border-b-2 px-1 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                isActive ? "border-accent font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "headers" ? "Headers" : "Body"}
            </button>
          );
        })}
      </div>

      {activeTab === "headers" ? (
        <div className="flex flex-col gap-2">
          {/* X-Request-ID: fila fija con borde punteado */}
          <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-line-strong px-3 py-2 font-mono text-[12.5px]">
            <span className="text-info">X-Request-ID</span>
            <span className="text-dim">|</span>
            <span className="min-w-0 flex-1 truncate text-dim">
              {customRequestId !== undefined && customRequestId !== ""
                ? customRequestId
                : "automático · uno nuevo en cada envío"}
            </span>
          </div>
          {headerRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <label htmlFor={`${row.id}-name`} className="sr-only">
                Nombre del header
              </label>
              <input
                id={`${row.id}-name`}
                className="min-h-[36px] min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-3 font-mono text-[12.5px] text-info outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                value={row.key}
                placeholder="Header-Name"
                spellCheck={false}
                onChange={(event) => updateHeaderRow(row.id, { key: event.target.value })}
              />
              <input
                className="min-h-[36px] min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-3 font-mono text-[12.5px] text-code outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                value={row.value}
                placeholder="valor"
                spellCheck={false}
                onChange={(event) => updateHeaderRow(row.id, { value: event.target.value })}
              />
              <button
                type="button"
                aria-label={`Quitar header ${row.key}`}
                className="min-h-[36px] w-9 shrink-0 rounded-[10px] text-ink-2 transition-colors hover:bg-err/10 hover:text-err focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                onClick={() => removeHeaderRow(row.id)}
              >
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M2.8 2.8l6.4 6.4M9.2 2.8L2.8 9.2" />
                </svg>
              </button>
            </div>
          ))}
          {/* Pie: candado + nota + añadir header */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[12px] text-dim">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="2.6" y="6.2" width="8.8" height="5.8" rx="1.1" />
                <path d="M4.7 6.2V4.6a2.3 2.3 0 0 1 4.6 0v1.6" strokeLinecap="round" />
              </svg>
              <span>Authorization y Cookie no se guardan en el historial.</span>
            <button
              type="button"
              className="ml-auto min-h-[36px] rounded-[10px] border border-line px-3 text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              onClick={addHeaderRow}
            >
              + header
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="req-body" className="sr-only">
            Body del request
          </label>
          <textarea
            id="req-body"
            className="min-h-[140px] w-full rounded-[10px] border border-line bg-bg px-3 py-2 font-mono text-[13px] text-code outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            value={noBody ? "" : body}
            disabled={noBody}
            spellCheck={false}
            placeholder={noBody ? "GET no lleva body." : `{"clave": "valor"}`}
            rows={6}
            onChange={(event) => setBody(event.target.value)}
          />
          {noBody && <p className="mt-1 text-[12px] text-dim">GET no lleva body.</p>}
        </div>
      )}
    </div>
  );
}
