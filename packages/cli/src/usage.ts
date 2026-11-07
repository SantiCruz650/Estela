/* Texto de --help: única fuente de verdad (cli.ts lo imprime; usage.test.ts lo valida). */

export const USAGE = `Estela CLI — sirve Estela en local y conecta los logs de tu backend.

Modo recomendado (un solo comando, sin archivos de log):
  npx @estela-dev/cli -- npm run dev
  npx @estela-dev/cli npm run dev          (también funciona sin "--")
  npx @estela-dev/cli --port 4100 -- python -u app.py

  El comando de TU backend es todo lo que no sea una opción de Estela (el
  separador "--" es opcional; útil cuando tu comando empieza con guiones).
  Estela lo arranca, te muestra su salida en esta misma terminal y
  correlaciona sus logs en vivo. Ctrl+C cierra Estela y tu proceso (con
  subprocesos).

Modo archivo de log (combinable con el modo proceso):
  npx @estela-dev/cli --port 4000 --log ruta/al/archivo.log
  npx @estela-dev/cli --log ./logs/app.log --log ./logs/errors.log -- npm run dev

Opciones:
  --port <n>     Puerto del dashboard (defecto 4000). Siempre escucha en 127.0.0.1.
  --log <ruta>   Archivo de log a exponer en GET /api/tail (repetible).
  --no-open      No abrir el navegador (útil en servidores o pruebas).
  -h, --help     Muestra esta ayuda.
`;
