import type { ReactNode } from "react";
import { LogLevelTag, MethodBadge, StatusBadge } from "../ui/primitives";

interface SideFeature {
  title: string;
  text: ReactNode;
}

const SIDE_FEATURES: SideFeature[] = [
  {
    title: "Tus datos no salen de aquí",
    text: (
      <>
        Tu .log se lee en tu navegador. Cuando cierras la pestaña, no queda
        nada fuera.{" "}
        <span className="text-slate-300">
          No nos creas: el código es abierto (
          <a
            href="https://github.com/SantiCruz650/Estela"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline-offset-2 transition-colors hover:text-cyan-200 hover:underline"
          >
            AGPL
          </a>
          ).{" "}
        </span>
        <a
          href="https://github.com/SantiCruz650/Estela"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 underline-offset-2 transition-colors hover:text-cyan-200 hover:underline"
        >
          Ver el código en GitHub →
        </a>
      </>
    ),
  },
  {
    title: "Un comando y listo",
    text: "npx @estela-dev/cli. Sin cuentas ni tarjetas.",
  },
  {
    title: "Una pantalla, nada más",
    text: "Lo esencial a la vista. Sin menús enterprise que nunca abres.",
  },
];

export default function Features(): JSX.Element {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 lg:py-20">
      <p className="font-mono text-sm text-amber-300">01</p>
      <h2 className="mt-2 max-w-prose text-2xl font-bold tracking-tight text-slate-100">
        Deja de cazar tu request entre ventanas
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-6 lg:col-span-7">
          <h3 className="text-xl font-bold tracking-tight text-slate-100">
            Disparas. Tu log se ilumina solo.
          </h3>
          <p className="mt-2 max-w-prose text-slate-400">
            Cada request sale con su propio ID. Cuando tu backend lo escupe en
            el log, Estela lo reconoce y te lo pone delante. Tú solo miras.
          </p>
          <div className="mt-4 space-y-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method="GET" />
              <span className="truncate text-slate-300">/api/users</span>
              <StatusBadge status={200} detail="OK" />
            </div>
            <div className="flex items-center gap-2 rounded bg-cyan-500/10 px-2 py-1 ring-1 ring-cyan-400/40">
              <LogLevelTag level="INFO" />
              <span className="truncate text-slate-300">GET /api/users → 200 (12ms)</span>
            </div>
            <p className="px-2 pt-1 font-sans text-xs text-slate-500">
              ↑ esa línea es tuya. Las demás, ruido.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5">
          {SIDE_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex-1 rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-4"
            >
              <h3 className="text-sm font-semibold text-slate-200">{feature.title}</h3>
              <p className="mt-0.5 max-w-prose text-sm text-slate-500">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
