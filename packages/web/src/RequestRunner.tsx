import { useState } from "react";
import { executeRequest } from "@devtool/core";
import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";
import RequestForm from "./components/RequestForm";
import ResponseViewer from "./components/ResponseViewer";
import { EXTENSION_INSTALL_URL } from "./config";
import { ExtensionIndicator } from "./ui/primitives";
import { useCorrelationStore } from "./lib/correlation-store";
import { saveHistory, toHistoryEntry } from "./lib/db";
import { executeRequestViaExtension } from "./lib/extension-bridge";
import type { ExtensionStatus } from "./hooks/useExtensionStatus";

interface RequestRunnerProps {
  extStatus: ExtensionStatus;
}

export default function RequestRunner({ extStatus }: RequestRunnerProps) {
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<HttpResponseInfo | null>(null);

  async function handleSend(input: HttpRequestInput): Promise<void> {
    setSending(true);
    try {
      let res: HttpResponseInfo;
      if (extStatus === "connected") {
        try {
          res = await executeRequestViaExtension(input);
        } catch (e) {
          console.warn("Extensión falló, usando fetch directo:", e);
          res = await executeRequest(input);
        }
      } else {
        res = await executeRequest(input);
      }
      setResponse(res);
      useCorrelationStore.getState().recordRequest({
        requestId: res.requestId,
        method: input.method,
        url: input.url,
        statusCode: res.status,
        startedAt: Date.now(),
        durationMs: res.durationMs,
      });
      try {
        await saveHistory(toHistoryEntry(input, res));
      } catch (e) {
        console.warn("No se pudo guardar en historial:", e);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl">
      <h2 className="text-xl font-semibold text-slate-100">Request runner</h2>
      <div className="mt-2 text-sm" role="status" aria-live="polite">
        <ExtensionIndicator state={extStatus} installHref={EXTENSION_INSTALL_URL} />
      </div>
      <div className="mt-4">
        <RequestForm onSend={(input) => void handleSend(input)} sending={sending} />
      </div>
      <ResponseViewer response={response} />
    </section>
  );
}
