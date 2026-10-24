import { Link } from "react-router-dom";

interface SiteFooterProps {
  compact?: boolean;
}

export default function SiteFooter({ compact = false }: SiteFooterProps): JSX.Element {
  const year = new Date().getFullYear();

  if (compact) {
    return (
      <footer className="border-t border-slate-800">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-16 pt-3 text-xs text-slate-500">
          <span>Estela · {year}</span>
          <span className="flex items-center gap-3">
            <Link to="/privacidad" className="transition-colors hover:text-cyan-300">
              Privacidad
            </Link>
            <Link to="/terminos" className="transition-colors hover:text-cyan-300">
              Términos
            </Link>
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-800">
      {/* Bottom padding amplio: el badge "estela.netlify.app" es fixed y taparía los links. */}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 pb-24 pt-10 text-center">
        <span className="text-lg font-semibold tracking-tight text-slate-100">Estela</span>
        <span className="flex items-center gap-4 text-sm text-slate-400">
          <Link to="/privacidad" className="transition-colors hover:text-cyan-300">
            Privacidad
          </Link>
          <Link to="/terminos" className="transition-colors hover:text-cyan-300">
            Términos
          </Link>
        </span>
        <p className="text-xs text-slate-500">© {year} Estela · Licencia: AGPL-3.0</p>
      </div>
    </footer>
  );
}
