import { Link } from "react-router-dom";
import SiteFooter from "../legal/SiteFooter";
import CtaFooter from "./CtaFooter";
import Features from "./Features";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";

const GITHUB_URL = "https://github.com/SantiCruz650/Estela";

export default function LandingPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3">
          <span className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
            <img src="/estela.svg" alt="Logo de Estela" className="h-6 w-6" />
            Estela
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {/* Icono oficial de GitHub (octicons mark-github, 16px). */}
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              GitHub
            </a>
            <Link
              to="/app"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
              Abrir Estela
            </Link>
          </span>
        </div>
      </header>
      <main>
        <Hero />
        <Features />
        <HowItWorks />
      </main>
      <CtaFooter />
      <SiteFooter />
    </div>
  );
}
