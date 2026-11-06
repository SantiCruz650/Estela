/* Argumentos del CLI en modo proceso: separar opciones (antes de "--") del
   comando del usuario (después de "--"), y plan de spawn por plataforma.
   Puro: sin Node, testeable igual en Vitest y en el navegador. */

/** Variables extra para el hijo: sin color y sin buffering (Python/print). */
export interface SpawnEnvVars {
  NO_COLOR: "1";
  FORCE_COLOR: "0";
  PYTHONUNBUFFERED: "1";
}

export interface ProcessArgvSplit {
  /** Tokens del usuario antes del "--" (opciones de Estela). */
  readonly before: readonly string[];
  /** Tokens del comando del usuario después del "--" (puede incluir "--"s extra). */
  readonly command: readonly string[];
}

/** Solo el PRIMER "--" separa; el resto pertenece al comando del usuario. */
export function splitArgvAtDashDash(argv: readonly string[]): ProcessArgvSplit {
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex === -1) {
    return { before: argv, command: [] };
  }
  return { before: argv.slice(0, separatorIndex), command: argv.slice(separatorIndex + 1) };
}

/** Etiqueta del comando para la UI y la terminal ("npm run dev"). */
export function processCommandLabel(command: readonly string[]): string {
  return command.join(" ");
}

/** Variables adicionales SIEMPRE idénticas para el hijo. */
export function processChildEnv(): SpawnEnvVars {
  return { NO_COLOR: "1", FORCE_COLOR: "0", PYTHONUNBUFFERED: "1" };
}

export interface SpawnPlanForCommand {
  readonly platform: string;
  /** true solo en Windows: npm es npm.cmd y exige shell. */
  readonly useShell: boolean;
  /** En Windows: comando como string único; null en otros sistemas. */
  readonly commandString: string | null;
  /** En macOS/Linux: argv para spawn sin shell (respeta tokens y comillas). */
  readonly argv: readonly string[] | null;
}

/**
 * Entrecomilla para cmd.exe los tokens con espacios o comillas (rutas como
 * C:\Program Files\... se parten sin comillas). Puro y testeable en Node
 * y en el navegador.
 */
function quoteForShell(token: string): string {
  if (!/[\s"]/.test(token)) {
    return token;
  }
  return `"${token.replaceAll('"', '\\"')}"`;
}

/** En Windows el spawn requiere shell (npx/npm son .cmd); en el resto no. */
export function spawnPlanForCommand(command: readonly string[], platform: string): SpawnPlanForCommand {
  const tokens = [...command];
  if (platform === "win32") {
    return { platform, useShell: true, commandString: tokens.map(quoteForShell).join(" "), argv: tokens };
  }
  return { platform, useShell: false, commandString: null, argv: tokens };
}
