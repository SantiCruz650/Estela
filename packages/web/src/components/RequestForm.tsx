import { useRef, useState } from "react";
import type { HttpRequestInput } from "@devtool/core";

type RequestFormProps = {
  onSend: (input: HttpRequestInput) => void;
  onCancel: () => void;
  sending: boolean;
};

type HeaderRow = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

const REQUEST_URL_KEY = "devtool.requestUrl";
const DEFAULT_URL = "http://localhost:3000/api/users";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function RequestForm({ onSend, onCancel, sending }: RequestFormProps) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState(() => localStorage.getItem(REQUEST_URL_KEY) ?? DEFAULT_URL);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([{ id: "row-0", key: "", value: "", enabled: true }]);
  const [body, setBody] = useState("");
  const rowCounter = useRef(1);

  const showBody = method !== "GET" && method !== "HEAD";

  function addHeaderRow(): void {
    const id = `row-${rowCounter.current}`;
    rowCounter.current += 1;
    setHeaderRows((rows) => [...rows, { id, key: "", value: "", enabled: true }]);
  }

  function removeHeaderRow(id: string): void {
    setHeaderRows((rows) => rows.filter((row) => row.id !== id));
  }

  function updateHeaderRow(id: string, patch: Partial<HeaderRow>): void {
    setHeaderRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleSend(): void {
    const headers: Record<string, string> = {};
    for (const row of headerRows) {
      if (row.enabled && row.key.trim() !== "") {
        headers[row.key] = row.value;
      }
    }
    onSend({ method, url, headers, body: body || undefined, requestId: newRequestId() });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
          onChange={(event) => setMethod(event.target.value)}
          value={method}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
          onChange={(event) => {
            setUrl(event.target.value);
            localStorage.setItem(REQUEST_URL_KEY, event.target.value);
          }}
          type="url"
          value={url}
        />
        <div className="flex gap-2">
          <button
            className="rounded-md bg-cyan-400 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            disabled={sending || url.trim() === ""}
            onClick={handleSend}
            type="button"
          >
            Enviar
          </button>
          {sending && (
            <button
              className="rounded-md border border-red-400/60 px-4 py-2 font-medium text-red-300 transition hover:border-red-400 hover:bg-red-400/10"
              onClick={onCancel}
              type="button"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Headers</h3>
          <button
            className="rounded border border-slate-600 px-2 py-1 text-sm text-slate-200 transition hover:border-cyan-400"
            onClick={addHeaderRow}
            type="button"
          >
            + header
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {headerRows.map((row) => (
            <div key={row.id} className={`flex items-center gap-2 ${row.enabled ? "" : "opacity-50"}`}>
              <input
                checked={row.enabled}
                onChange={(event) => updateHeaderRow(row.id, { enabled: event.target.checked })}
                type="checkbox"
              />
              <input
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-cyan-400"
                onChange={(event) => updateHeaderRow(row.id, { key: event.target.value })}
                placeholder="key"
                value={row.key}
              />
              <input
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-cyan-400"
                onChange={(event) => updateHeaderRow(row.id, { value: event.target.value })}
                placeholder="value"
                value={row.value}
              />
              <button
                className="rounded px-2 py-1 text-sm text-slate-400 transition hover:text-red-300"
                onClick={() => removeHeaderRow(row.id)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {showBody && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Body</h3>
          <textarea
            className="font-mono w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            value={body}
          />
        </div>
      )}
    </div>
  );
}
