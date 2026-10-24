// URLs públicas de Estela: el repo es la única fuente de instalación de la
// extensión (paso 5 de "Correr en local" en el README). Los primitivos de UI
// no hardcodean URLs: la reciben por prop.

export const REPO_URL = "https://github.com/SantiCruz650/Estela";

export const EXTENSION_INSTALL_URL = `${REPO_URL}#correr-en-local`;

declare global {
  interface Window {
    /** Inyectado por el CLI local (npx estela) al servir index.html. */
    __ESTELA_CLI_TOKEN__?: string;
  }
}

/** Devuelve el token del CLI si la app fue servida por `npx estela`; si no, null. */
export function getCliToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.__ESTELA_CLI_TOKEN__;
  return typeof token === "string" && token !== "" ? token : null;
}

/** true cuando corre dentro del CLI local (proxy /api/proxy y tail /api/tail disponibles). */
export function isCliMode(): boolean {
  return getCliToken() !== null;
}
