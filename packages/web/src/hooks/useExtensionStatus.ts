import { useEffect, useState } from "react";
import { isCliMode } from "../config";
import { isExtensionAvailable } from "../lib/extension-bridge";

export type ExtensionStatus = "checking" | "connected" | "unavailable" | "local";

export function useExtensionStatus(): ExtensionStatus {
  // En modo CLI el estado inicial ya es "local": no se verifica extensión.
  const [status, setStatus] = useState<ExtensionStatus>(() => (isCliMode() ? "local" : "checking"));

  useEffect(() => {
    if (isCliMode()) {
      return;
    }
    isExtensionAvailable()
      .then((ok) => setStatus(ok ? "connected" : "unavailable"))
      .catch(() => setStatus("unavailable"));
  }, []);

  return status;
}
