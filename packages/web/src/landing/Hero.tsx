import { useState } from "react";
import { Link } from "react-router-dom";
import HeroDemo from "./HeroDemo";
import { copyText } from "../lib/clipboard";

const CLI_COMMAND = "npx @estela-dev/cli";

export default function Hero(): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    const ok = await copyText(CLI_COMMAND);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-16 lg:pb-24 lg:pt-24">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="animate-fade-up min-w-0" style={{ animationDelay: "0ms" }}>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Local-first · Sin cuentas · Sin nube
          </p>
          <h1 className="mt-3 font-sans text-5xl font-black tracking-tighter text-slate-50 sm:text-6xl lg:text-7xl">
            Tu request y su rastro de logs,{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
              en la misma pantalla.
            </span>
          </h1>
          <p className="mt-4 max-w-prose text-lg text-slate-400">
            Disparas tu API en localhost y sus líneas de log aparecen resaltadas
            al lado. Sin cuentas, sin nube: todo en tu navegador.
          </p>
          <div className="mt-6 max-w-md">
            {/* CTA principal: el comando ES la invitación. Probable antes que bonito. */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
              <span aria-hidden="true" className="select-none font-mono text-slate-500">
                $
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-cyan-300">
                {CLI_COMMAND}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="shrink-0 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-3 py-1.5 font-mono text-sm text-cyan-200 transition-colors hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                title="Copiar el comando al portapapeles"
              >
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/app"
                className="rounded-md border border-slate-600 px-5 py-2.5 font-medium text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                Probar la demo
              </Link>
              <a
                href="#como-funciona"
                className="rounded-md px-5 py-2.5 font-medium text-slate-400 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>
        </div>

        <div className="animate-fade-up min-w-0" style={{ animationDelay: "150ms" }}>
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
