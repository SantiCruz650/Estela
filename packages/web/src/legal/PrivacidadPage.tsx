import { Link } from "react-router-dom";

export default function PrivacidadPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto w-full max-w-prose px-4 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Privacidad
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Tus datos se quedan contigo
        </h1>
        <div className="mt-6 space-y-4 text-slate-300">
          <p>
            Estela funciona en tu navegador. No pedimos cuentas ni guardamos tus
            peticiones o registros en nuestros servidores, porque no tenemos
            servidores para eso.
          </p>
          <p>
            Tu historial vive en tu propio navegador (IndexedDB) y tus archivos
            de registro se leen en local. Si borras los datos del sitio, se
            borra todo.
          </p>
          <p>
            No usamos cookies innecesarias ni servicios de terceros para
            rastrearte. Si tienes dudas, escríbenos a{" "}
            <a
              href="mailto:esteladevsupport@gmail.com"
              className="text-cyan-300 underline-offset-2 transition-colors hover:text-cyan-200 hover:underline"
            >
              esteladevsupport@gmail.com
            </a>{" "}
            y lo aclaramos.
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
