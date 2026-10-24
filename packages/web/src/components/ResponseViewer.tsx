import { useState } from "react";
import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";
import { useCorrelationStore } from "../lib/correlation-store";
import { trailColor, trailTint } from "../lib/trail-colors";
import { tokenizeBody, type JsonToken } from "../lib/json-tokens";
import { toCurl } from "../lib/curl";
import { formatBytes } from "../lib/format";
import { copyText } from "../lib/clipboard";

interface ResponseViewerProps {
  response: HttpResponseInfo | null;
  input: HttpRequestInput | null;
}

const TOKEN_CLASSES: Record<JsonToken["kind"], string> = {
  key: "text-info",
  string: "text-warn",
  number: "text-violet-2",
  boolean: "text-accent",
  null: "text-accent",
  rest: "text-code",
};

const ERROR_TEXTS: Record<NonNullable<HttpResponseInfo["error"]>, string> = {
  network: "No se pudo conectar al backend (¿está corriendo?).",
  timeout: "La request tardó demasiado y se canceló (30 s).",
  aborted: "Request cancelada.",
};

/** Bloque JSON coloreado con el tokenizador propio (solo <span>, sin HTML). */
function ColoredBody({ tokens }: { tokens: JsonToken[] }): JSX.Element {
  return (
    <code>
      {tokens.map((token, i) => (
        <span key={`${i}-${token.kind}`} className={TOKEN_CLASSES[token.kind]}>
          {token.value}
        </span>
      ))}
    </code>
  );
}

export default function ResponseViewer({ response, input }: ResponseViewerProps): JSX.Element {
  const [tab, setTab] = useState<"body" | "headers">("body");
  const [curlCopied, setCurlCopied] = useState(false);
  const getTrailColorIndex = useCorrelationStore((state) => state.getTrailColorIndex);

  const errorText =
    response === null || response.error === undefined
      ? null
      : (ERROR_TEXTS[response.error] ?? "Error al ejecutar el request.");

  const trailIndex = response === null || response.error !== undefined ? null : getTrailColorIndex(response.requestId);
  const tokens = response === null || response.status === 204 ? null : tokenizeBody(response.bodyText);

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3">
      {/* Fila superior: status + métricas + chip de rastro + cURL */}
      {response !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-label={`Estado ${response.error === undefined ? `${response.status} ${response.statusText}` : "error"}`}
            className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold ${
              response.error !== undefined || response.status >= 400
                ? "bg-[rgba(251,113,133,0.14)] text-err"
                : "bg-[rgba(52,211,153,0.12)] text-ok"
            }`}
          >
            {response.error === undefined ? `${response.status} ${response.statusText}` : "Error"}
          </span>
          {response.error === undefined && (
            <>
              <span className="text-[12.5px] text-ink-2">{Math.round(response.durationMs)} ms</span>
              <span className="text-dim">·</span>
              <span className="font-mono text-[12px] text-dim">{formatBytes(response.bytesRead)}</span>
              {trailIndex !== null && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] text-ink-2"
                  style={{ borderColor: trailColor(trailIndex), backgroundColor: trailTint(trailIndex, 0.1) }}
                >
                  <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: trailColor(trailIndex) }} />
                  rastro {response.requestId.slice(0, 8)}
                </span>
              )}
            </>
          )}
          <button
            type="button"
            className="ml-auto min-h-[36px] rounded-[10px] border border-line px-3 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={() => {
              if (input === null) {
                return;
              }
              void copyText(toCurl(input)).then((ok) => {
                if (ok) {
                  setCurlCopied(true);
                  window.setTimeout(() => setCurlCopied(false), 1400);
                }
              });
            }}
          >
            {curlCopied ? "cURL copiado" : "Copiar como cURL"}
          </button>
        </div>
      )}

      {/* Pestañas Respuesta / Headers */}
      {response !== null && (
        <div className="flex items-baseline gap-4 border-b border-line" role="tablist" aria-label="Vistas de la respuesta">
          {([
            ["body", "Respuesta"],
            ["headers", "Headers"],
          ] as const).map(([key, label]) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-pressed={isActive}
                aria-selected={isActive}
                className={`-mb-px border-b-2 px-1 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isActive ? "border-accent font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {response === null ? (
        <p className="mt-1 rounded-[10px] border border-line bg-bg px-3 py-4 text-[12.5px] text-dim">
          Dispara arriba y la respuesta cae aquí.
        </p>
      ) : tab === "headers" ? (
        /* Headers de respuesta: clave 150px / valor con anywhere */
        <ul className="flex flex-col gap-1 rounded-[10px] border border-line bg-bg px-3 py-2">
          {Object.entries(response.responseHeaders).map(([key, value]) => (
            <li key={key} className="flex flex-wrap items-baseline gap-2 font-mono text-[12.5px]">
              <span className="min-w-[150px] text-info">{key}</span>
              <span className="min-w-0 flex-1 text-code break-all" style={{ overflowWrap: "anywhere" }}>
                {value}
              </span>
            </li>
          ))}
          {Object.keys(response.responseHeaders).length === 0 && <li className="text-[12.5px] text-dim">Sin headers de respuesta.</li>}
        </ul>
      ) : response.error !== undefined ? (
        /* Errores (red, timeout, abort, CLI 403) en esta misma tarjeta.
           El mensaje del CLI (proxy 403, red caída) llega en bodyText. */
        <p
          className="rounded-[10px] border border-err/50 bg-[rgba(251,113,133,0.10)] px-3 py-3 font-mono text-[12.5px] leading-[1.7] text-err"
          role="alert"
        >
          {response.error === "network" && response.bodyText !== "" ? response.bodyText : (errorText ?? response.bodyText)}
        </p>
      ) : response.status === 204 ? (
        <div className="max-h-[300px] overflow-auto rounded-[10px] border border-line bg-bg px-3 py-2 font-mono text-[12.5px] leading-[1.7] text-dim">
          <code>{"// Sin contenido (204)"}</code>
        </div>
      ) : (
        <div className="max-h-[300px] overflow-auto rounded-[10px] border border-line bg-bg px-3 py-2 font-mono text-[12.5px] leading-[1.7] text-code">
          {tokens === null ? (
            <span className="whitespace-pre-wrap">{response.bodyText}</span>
          ) : (
            <ColoredBody tokens={tokens} />
          )}
        </div>
      )}
    </div>
  );
}
