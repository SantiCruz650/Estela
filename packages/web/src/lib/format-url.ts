/* Vista de URL como ruta: /api/agent (más query). Igual criterio en el
   historial y en la barra del rastro; sin dominio ni hash. Pura. */

export function urlPathView(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
