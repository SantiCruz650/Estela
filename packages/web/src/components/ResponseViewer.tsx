import type { HttpResponseInfo } from "@devtool/core";
import { CopyButton, StatusBadge } from "../ui/primitives";

type ResponseViewerProps = {
  response: HttpResponseInfo | null;
};

export default function ResponseViewer({ response }: ResponseViewerProps) {
  if (response === null) {
    return <p className="mt-4 text-sm text-slate-400">Dispara arriba y la respuesta cae aquí.</p>;
  }

  if (response.error === "network") {
    console.warn(
      "[estela] error de red al disparar: posible CORS, backend caído o timeout.",
      { requestId: response.requestId, durationMs: response.durationMs },
    );
    return (
      <p className="mt-4 rounded border border-red-400/50 bg-red-400/10 px-3 py-2 text-sm text-red-200">
        {response.bodyText !== "" ? response.bodyText : "No se pudo conectar al backend."}
      </p>
    );
  }

  if (response.error === "timeout") {
    return (
      <p className="mt-4 rounded border border-red-400/50 bg-red-400/10 px-3 py-2 text-sm text-red-200">
        La request tardó demasiado y se canceló (30 s).
      </p>
    );
  }

  if (response.error === "aborted") {
    return (
      <p className="mt-4 text-sm text-slate-400">
        Request cancelada.
      </p>
    );
  }

  let prettyBody: string;
  try {
    const parsed: unknown = JSON.parse(response.bodyText);
    prettyBody = JSON.stringify(parsed, null, 2);
  } catch {
    prettyBody = response.bodyText;
  }

  return (
    <div className="mt-4">
      <StatusBadge status={response.status} detail={response.statusText} />
      <p className="mt-2 text-sm text-slate-300">
        {Math.round(response.durationMs)} ms · {response.bytesRead} bytes
        {response.bodyTruncated && <span className="ml-2 text-amber-200">Body truncado a 1 MB</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CopyButton text={response.requestId} label={`UUID: ${response.requestId}`} />
        {response.backendRequestId !== undefined && (
          <span className="max-w-full truncate rounded-full border border-slate-600 px-3 py-1.5 text-sm text-slate-300">
            ID devuelto por el servidor: {response.backendRequestId}
          </span>
        )}
      </div>
      <details className="mt-3 text-sm text-slate-300">
        <summary className="cursor-pointer text-slate-200">Headers de respuesta</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {Object.entries(response.responseHeaders).map(([key, value]) => (
            <li key={key} className="font-mono break-all">
              {key}: {value}
            </li>
          ))}
        </ul>
      </details>
      <pre className="no-scrollbar font-mono whitespace-pre-wrap mt-3 max-h-96 overflow-auto rounded border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100">
        {prettyBody}
      </pre>
    </div>
  );
}
