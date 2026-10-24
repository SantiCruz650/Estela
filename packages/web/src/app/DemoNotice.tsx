import { useState } from "react";
import { copyText } from "../lib/clipboard";
import { isCliMode } from "../config";

const DISMISSED_KEY = "estela.demoBannerDismissed";
const CLI_COMMAND = "npx @estela-dev/cli";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Aviso de demo fuera del modo CLI: caja con comando, copiar y cerrar.
    Estado inicial derivado (sin effect): CLI sirve el HTML token al boot. */
export default function DemoNotice(): JSX.Element | null {
  const [visible, setVisible] = useState(() => !isCliMode() && !wasDismissed());
  const [copied, setCopied] = useState(false);

  if (!visible) {
    return null;
  }

  function close(): void {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // localStorage bloqueado: solo cierra en esta sesión
    }
  }

  return (
    <div
      className="mx-auto mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-[#1F3A4A] bg-[#0A1A24] px-4 py-3 lg:mx-7"
      role="status"
    >
      <span className="text-[13px] text-ink-2">
        Estás viendo la demo en vivo.{" "}
        <span className="text-dim">Para conectar tu propio backend, corre esto en tu terminal:</span>
      </span>
      <code className="rounded-[8px] bg-bg px-2.5 py-1 font-mono text-[12.5px] text-accent">{CLI_COMMAND}</code>
      <button
        type="button"
        className="min-h-[36px] rounded-[10px] border border-[#1F3A4A] px-3 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        onClick={() => {
          void copyText(CLI_COMMAND).then((ok) => {
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }
          });
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso"
        title="Cerrar aviso"
        className="ml-auto flex h-[36px] w-9 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        onClick={close}
      >
        ✕
      </button>
    </div>
  );
}
