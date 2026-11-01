import { useEffect, useRef, useState } from "react";
import CodeBlock from "./CodeBlock";
import { BACKEND_ID_HINT, BACKEND_SNIPPETS } from "./backend-snippets";

interface BackendModalProps {
  onClose: () => void;
}

/** Fragmentos con foco atrapado, Escape cierra, aria-modal y título accesible. */
export default function BackendModal({ onClose }: BackendModalProps): JSX.Element {
  const [activeId, setActiveId] = useState(BACKEND_SNIPPETS[0].id);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const active = BACKEND_SNIPPETS.find((snippet) => snippet.id === activeId) ?? BACKEND_SNIPPETS[0];

  function focusableIn(root: HTMLElement): HTMLElement[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = dialogRef.current;
    if (root !== null) {
      const focusables = focusableIn(root);
      focusables[0]?.focus();
    }
    return () => {
      restoreFocusRef.current?.focus();
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const root = dialogRef.current;
    if (root === null) {
      return;
    }
    const focusables = focusableIn(root);
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = event.target instanceof HTMLElement ? event.target : null;
    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (current === first || current === null)) {
      event.preventDefault();
      last.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" onKeyDown={handleKeyDown}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backend-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="backend-modal-title" className="text-[16px] font-bold text-ink">
              Conecta tu backend
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-2">{BACKEND_ID_HINT}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="shrink-0 min-h-[32px] w-9 rounded-[8px] border border-line text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Framework del backend">
            {BACKEND_SNIPPETS.map((snippet) => {
              const isActive = snippet.id === activeId;
              return (
                <button
                  key={snippet.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  id={`backend-tab-${snippet.id}`}
                  aria-controls={`backend-panel-${snippet.id}`}
                  className={`min-h-[32px] rounded-full border px-3 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    isActive ? "border-line-strong bg-elevated font-semibold text-ink" : "border-line bg-bg text-ink-2 hover:text-ink"
                  }`}
                  onClick={() => setActiveId(snippet.id)}
                >
                  {snippet.label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`backend-panel-${active.id}`}
            aria-labelledby={`backend-tab-${active.id}`}
            className="mt-3"
          >
            <p className="mb-2 text-[12.5px] text-ink-2">{active.description}</p>
            <CodeBlock code={active.code} ariaLabel={`Fragmento para ${active.label}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
