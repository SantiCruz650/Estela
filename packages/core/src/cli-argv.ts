/* Parser de argv de Estela SIN depender del "--": el shim estela.ps1 que
   npm genera para Windows PIERDE el "--" (PowerShell lo consume como
   marcador de fin de parámetros antes de pasárnoslo), y npx hace algo
   parecido. Reglas (en orden):
   1. Se consumen solo las opciones de Estela: --port N, --log RUTA
      (repetible), --no-open, -h/--help, con variantes --port=N / --log=RUTA.
   2. Un "--" aísla: todo lo que sigue es el comando del usuario.
   3. Un argumento que no es opción de Estela arranca el comando del
      usuario: desde ahí, TODO es suyo (incluidas opciones como --port).
   4. Una opción desconocida ANTES del comando → error claro en español
      (sin stack trace).
   Puro: sin Node, testeable igual en Vitest y en el navegador. */

export interface EstelaCliArgs {
  /** undefined = usar el puerto por defecto (el CLI valida 1..65535). */
  readonly port: number | undefined;
  /** Rutas de archivos --log acumuladas en orden. */
  readonly logFiles: readonly string[];
  readonly noOpen: boolean;
  readonly help: boolean;
  /** Comando del usuario (vacío si no hay; el CLI avisa si falta). */
  readonly command: readonly string[];
}

export type EstelaCliArgsResult =
  | { readonly ok: true; readonly args: EstelaCliArgs }
  | { readonly ok: false; readonly message: string };

const UNKNOWN_OPTION_HINT =
  "Si es parte del comando de TU backend, sepáralo con doble guión al final: estela -- <tu comando>";

function parsePortValue(value: string): number | string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "la opción --port necesita un número de puerto, p. ej. --port 4100";
  }
  const port = Number(trimmed);
  if (!Number.isInteger(port)) {
    return `el valor de --port debe ser un número, pero recibí "${trimmed}"`;
  }
  return port;
}

export function parseEstelaArgv(argv: readonly string[]): EstelaCliArgsResult {
  let port: number | undefined;
  const logFiles: string[] = [];
  let noOpen = false;
  let help = false;

  function finish(): EstelaCliArgsResult;
  function finish(command: readonly string[]): EstelaCliArgsResult;
  function finish(command: readonly string[] = []): EstelaCliArgsResult {
    return {
      ok: true,
      args: { port, logFiles: [...logFiles], noOpen, help, command: [...command] },
    };
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    // Resto del comando del usuario, sea tras "--" o tras un parámetro de
    // Estela que llega en la posición equivocada.
    if (token === "--") {
      return finish(argv.slice(i + 1));
    }
    if (token === "--port" || token.startsWith("--port=")) {
      const value = token === "--port" ? (argv[i + 1] ?? "") : token.slice("--port=".length);
      if (token === "--port") {
        i += 1;
      }
      const portValue = parsePortValue(value);
      if (typeof portValue === "string") {
        return { ok: false, message: portValue };
      }
      // Último --port gana (los duplicados no son error).
      port = portValue;
      continue;
    }
    if (token === "--log" || token.startsWith("--log=")) {
      const value = token === "--log" ? argv[i + 1] : token.slice("--log=".length);
      if (token === "--log") {
        i += 1;
      }
      if (value === undefined || value === "") {
        return { ok: false, message: "la opción --log necesita la ruta de un archivo de log, p. ej. --log ruta/app.log" };
      }
      logFiles.push(value);
      continue;
    }
    if (token === "--no-open") {
      noOpen = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      help = true;
      continue;
    }
    if (token.startsWith("-")) {
      return {
        ok: false,
        message: `no conozco la opción "${token}". ${UNKNOWN_OPTION_HINT}, o mira el uso con --help.`,
      };
    }
    // Primer token que no es opción de Estela: TODO lo que sigue (el token
    // incluido) es el comando del usuario y sus opciones.
    return finish(argv.slice(i));
  }
  return finish();
}
