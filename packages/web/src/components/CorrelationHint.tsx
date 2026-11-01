import { useState } from "react";
import { useCorrelationStore } from "../lib/correlation-store";
import { shouldShowIdHint } from "../lib/id-hint";
import { useSourceStore } from "../lib/source-state";
import BackendModal from "./BackendModal";

const ID_HINT_DISMISS_KEY = "estela.idHintDismissed";

/** Aviso: logs sin ID de request → coincidencias probables por tiempo. */
export default function CorrelationHint(): JSX.Element {
  const source = useSourceStore((state) => state.source);
  const requests = useCorrelationStore((state) => state.requests);
  const buffer = useCorrelationStore((state) => state.buffer);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ID_HINT_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [modalOpen, setModalOpen] = useState(false);

  function dismiss(): void {
    setDismissed(true);
    try {
      localStorage.setItem(ID_HINT_DISMISS_KEY, "1");
    } catch {
      // storage bloqueado: el aviso solo se cierra para esta sesión
    }
  }

  if (dismissed || !shouldShowIdHint(source, requests, buffer)) {
    return <></>;
  }

  return (
    <>
      <div
        role="note"
        className="flex flex-wrap items-center gap-2 rounded-[10px] border border-warn/40 bg-[rgba(245,184,61,0.08)] px-3 py-2 text-[12.5px] text-ink"
      >
        <span className="min-w-0 flex-[1_1_320px]">
          Tus logs no incluyen el ID de cada request. Te mostramos coincidencias
          probables por tiempo. Para correlación exacta, agrega una línea a tu backend.
        </span>
        <button
          type="button"
          className="shrink-0 min-h-[32px] rounded-[10px] border border-line-strong bg-elevated px-3 text-[12px] font-semibold text-ink transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          onClick={() => setModalOpen(true)}
        >
          Ver cómo
        </button>
        <button
          type="button"
          aria-label="Cerrar aviso"
          className="shrink-0 min-h-[32px] w-8 rounded-[8px] text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
      {modalOpen && <BackendModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
