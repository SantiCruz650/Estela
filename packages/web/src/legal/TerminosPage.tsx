import { Link } from "react-router-dom";

const CONTACTO = "esteladevsupport@gmail.com";

export default function TerminosPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto w-full max-w-prose px-4 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Términos
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Términos de uso de Estela
        </h1>
        <div className="mt-6 space-y-4 text-slate-300">
          <p>
            <strong>Qué es Estela.</strong> Estela es una herramienta gratuita y
            de código abierto, bajo la licencia AGPL-3.0. Corre en tu navegador
            o en tu propia máquina: no la sostiene un servidor nuestro.
          </p>
          <p>
            <strong>Sin garantías.</strong> Estela se ofrece "tal cual", sin
            garantías de ningún tipo, tal como permite la AGPL. Úsala bajo tu
            propia responsabilidad.
          </p>
          <p>
            <strong>Sus datos.</strong> No recopilamos datos personales ni
            telemetría. Cómo maneja Estela lo que ya vive en tu máquina está en
            la <Link to="/privacidad" className="text-cyan-300 underline-offset-2 hover:underline">Política de Privacidad</Link>.
          </p>
          <p>
            <strong>Uso aceptable.</strong> Usa Estela solo contra sistemas que
            te pertenecen o para los que tienes permiso explícito para probar.
            No la uses para dañar servicios ajenos ni para nada ilegal.
          </p>
          <p>
            <strong>Responsabilidad.</strong> En la medida máxima que permita la
            ley, los autores no serán responsables de ningún daño derivado del
            uso de Estela.
          </p>
          <p>
            <strong>Cambios.</strong> Podemos actualizar estos términos; la
            fecha de la última actualización te indicará si cambiaron.
          </p>
          <p>
            <strong>Contacto.</strong>{" "}
            <a
              href={`mailto:${CONTACTO}`}
              className="text-cyan-300 underline-offset-2 transition-colors hover:text-cyan-200 hover:underline"
            >
              {CONTACTO}
            </a>
          </p>
        </div>
        <p className="mt-6 text-sm text-slate-500">Última actualización: octubre de 2026.</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-md border border-slate-600 px-5 py-2.5 font-medium text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          ← Volver al inicio
        </Link>
      </main>
    </div>
  );
}
