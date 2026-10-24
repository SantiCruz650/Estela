import { useRef, useState } from "react";
import { executeRequest } from "@devtool/core";
import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";
import RequestForm from "./components/RequestForm";
import ResponseViewer from "./components/ResponseViewer";
import { getCliToken, isCliMode } from "./config";
import { useCorrelationStore } from "./lib/correlation-store";
import { useResponseStore } from "./lib/response-store";
import { useSourceStore } from "./lib/source-state";
import { saveHistory, toHistoryEntry } from "./lib/db";
import { executeRequestViaCli } from "./lib/cli-bridge";
import { executeRequestViaExtension } from "./lib/extension-bridge";
import { dispatchDemoRequest } from "./lib/demo-run";
import type { ExtensionStatus } from "./hooks/useExtensionStatus";

interface RequestRunnerProps {
  extStatus: ExtensionStatus;
}

export default function RequestRunner({ extStatus }: RequestRunnerProps): JSX.Element {
  const [sending, setSending] = useState(false);
  const response = useResponseStore((state) => state.response);
  const input = useResponseStore((state) => state.input);
  const abortRef = useRef<AbortController | null>(null);

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  async function recordAndSave(inputValue: HttpRequestInput, res: HttpResponseInfo): Promise<void> {
    useCorrelationStore.getState().recordRequest({
      requestId: res.requestId,
      method: inputValue.method,
      url: inputValue.url,
      statusCode: res.status,
      startedAt: Date.now(),
      durationMs: res.durationMs,
    });
    try {
      await saveHistory(toHistoryEntry(inputValue, res));
    } catch (error) {
      console.warn("No se pudo guardar en historial:", error);
    }
  }

  async function handleSend(inputValue: HttpRequestInput): Promise<void> {
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (isCliMode()) {
        // Modo CLI: SIN fallback a fetch directo (CORS volvería a romper).
        try {
          const res = await executeRequestViaCli(inputValue, getCliToken() ?? "", controller.signal);
          if (controller.signal.aborted) {
            return;
          }
          useResponseStore.getState().setResponse(res, inputValue);
          await recordAndSave(inputValue, res);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          useResponseStore.getState().setResponse(
            {
              requestId: inputValue.requestId,
              status: 0,
              statusText: "",
              responseHeaders: {},
              bodyText: error instanceof Error ? error.message : String(error),
              bodyTruncated: false,
              bytesRead: 0,
              durationMs: 0,
              error: "network",
            },
            inputValue,
          );
        }
        return;
      }

      const source = useSourceStore.getState().source;
      if (source === "demo") {
        // Fuente demo: responder en memoria, sin red.
        const res = await dispatchDemoRequest(inputValue);
        useResponseStore.getState().setResponse(res, inputValue);
        return;
      }

      if (extStatus === "connected") {
        try {
          const res = await executeRequestViaExtension(inputValue, controller.signal);
          if (controller.signal.aborted) {
            return;
          }
          useResponseStore.getState().setResponse(res, inputValue);
          await recordAndSave(inputValue, res);
          return;
        } catch (error) {
          console.warn("Extensión falló, usando fetch directo:", error);
          // cae al fetch directo
        }
      }
      const result = await executeRequest(inputValue, fetch, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      useResponseStore.getState().setResponse(result, inputValue);
      await recordAndSave(inputValue, result);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setSending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="rounded-[14px] border border-line bg-surface p-4" aria-label="Request">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Request</h2>
        <div className="mt-3">
          <RequestForm onSend={(value) => void handleSend(value)} onCancel={handleCancel} sending={sending} />
        </div>
      </section>
      <section className="rounded-[14px] border border-line bg-surface p-4 min-w-0" aria-label="Respuesta">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Respuesta</h2>
        <ResponseViewer response={response} input={input} />
      </section>
    </div>
  );
}
