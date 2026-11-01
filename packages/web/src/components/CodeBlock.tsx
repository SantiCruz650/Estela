import { useState } from "react";
import { copyText } from "../lib/clipboard";

interface CodeBlockProps {
  code: string;
  /** Texto del enlace accesible del botón; el code no se lee en cada render. */
  ariaLabel?: string;
}

/** Bloque de código copiable: <pre><code> + botón que copia el contenido. */
export default function CodeBlock({ code, ariaLabel }: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <div className="flex items-stretch gap-2 overflow-hidden rounded-[10px] border border-line bg-bg">
      <pre
        className="min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-[12px] leading-[1.6] text-code"
        aria-label={ariaLabel}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        aria-pressed={copied}
        className="shrink-0 self-center mr-2 min-h-[32px] rounded-[8px] border border-line-strong bg-elevated px-3 text-[12px] text-ink transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        onClick={() => void handleCopy()}
      >
        {copied ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
