import type { ExtensionStatus } from "../hooks/useExtensionStatus";
import { isCliMode } from "../config";
import type { SourceId } from "./source-state";

export type ConnectionState = "cli" | "extension" | "demo" | "offline";

export interface ConnectionView {
  state: ConnectionState;
  dotClass: string;
  label: string;
  detail: string;
}

/** Indicador único de conexión del header: CLI > extensión > demo > sin conexión. */
export function connectionView(
  source: SourceId,
  sourceRunning: boolean,
  extStatus: ExtensionStatus,
  statusText: string,
): ConnectionView {
  if (isCliMode()) {
    return { state: "cli", dotClass: "bg-ok", label: "Modo local", detail: statusText };
  }
  if (extStatus === "connected") {
    return { state: "extension", dotClass: "bg-accent", label: "Extensión", detail: "Estela Bridge" };
  }
  if (source === "demo" && sourceRunning) {
    return { state: "demo", dotClass: "bg-warn", label: "Demo", detail: "datos simulados" };
  }
  return { state: "offline", dotClass: "bg-dim", label: "Sin conexión", detail: "usa npx @estela-dev/cli" };
}
