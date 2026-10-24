import { Link } from "react-router-dom";

export default function CtaFooter(): JSX.Element {
  return (
    <footer className="border-t border-slate-800">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-16 text-center">
        <h2 className="max-w-prose font-sans text-3xl font-extrabold tracking-tight text-slate-50">
          Deja de saltar entre 4 ventanas
        </h2>
        <Link
          to="/app"
          className="mt-2 rounded-lg bg-cyan-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 lg:text-lg"
        >
          Abrir Estela
        </Link>
      </div>
    </footer>
  );
}
