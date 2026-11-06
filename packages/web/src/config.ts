// URLs públicas de Estela: el repo es la única fuente de instalación de la
// extensión (paso 5 de "Correr en local" en el README). Los primitivos de UI
// no hardcodean URLs: la reciben por prop.

export const REPO_URL = "https://github.com/SantiCruz650/Estela";

export const EXTENSION_INSTALL_URL = `${REPO_URL}#correr-en-local`;

declare global {
  interface Window {
    /** Inyectado por el CLI local (npx @estela-dev/cli) al servir index.html. */
    __ESTELA_CLI_TOKEN__?: string;
    /** Nº de archivos --log que el CLI configuró; falta en un CLI antiguo. */
    __ESTELA_CLI_LOG_COUNT__?: number;
    /** Etiqueta del comando que el CLI arrancó con `--` (null si no hay proceso). */
    __ESTELA_CLI_PROCESS__?: string | null;
  }
}

/** Devuelve el token del CLI si la app fue servida por `npx @estela-dev/cli`; si no, null. */
export function getCliToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.__ESTELA_CLI_TOKEN__;
  return typeof token === "string" && token !== "" ? token : null;
}

/**
 * Nº de archivos --log del CLI (inyectado junto al token en el HTML).
 * null si no hay dato: CLI antiguo, sin modo CLI, o valor no numérico.
 */
export function getCliLogCount(): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const count = window.__ESTELA_CLI_LOG_COUNT__;
  return typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : null;
}

/**
 * Comando que el CLI arrancó con `npx @estela-dev/cli -- <comando>`
 * (inyectado junto al token en el HTML). null si no hay proceso:
 * CLI antiguo, modo sin `--`, o valor no string.
 */
export function getCliProcessCommand(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const command = window.__ESTELA_CLI_PROCESS__;
  return typeof command === "string" && command !== "" ? command : null;
}

/** true cuando corre dentro del CLI local (proxy /api/proxy y tail /api/tail disponibles). */
export function isCliMode(): boolean {
  return getCliToken() !== null;
}

/** true cuando además el CLI arrancó un proceso con `-- <comando>`. */
export function isCliProcessMode(): boolean {
  return isCliMode() && getCliProcessCommand() !== null;
}
