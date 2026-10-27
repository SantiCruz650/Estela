/* Texto de --help: única fuente de verdad (cli.ts lo imprime; usage.test.ts lo valida). */

export const USAGE = `Estela CLI — sirve Estela en local y puentea tu backend sin CORS.

Uso:
  npx @estela-dev/cli [--port 4000] [--log ruta/al/archivo.log] [--no-open]

Opciones:
  --port <n>     Puerto (defecto 4000). Siempre escucha en 127.0.0.1.
  --log <ruta>   Archivo de log a exponer en GET /api/tail (repetible).
  --no-open     No abrir el navegador (útil en servidores o pruebas).
  -h, --help     Muestra esta ayuda.
`;
