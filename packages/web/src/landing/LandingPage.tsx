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
              className="text-sm font-medium text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
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
