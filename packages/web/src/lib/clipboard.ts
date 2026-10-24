/* Copiar texto al portapapeles con fallback:
   1) navigator.clipboard.writeText (requiere contexto seguro).
   2) textarea oculta + document.execCommand("copy") (navegadores/contextos
      que bloquean la API asincrónica).
   `doc` se inyecta para poder testear sin DOM real. */

export async function copyText(text: string, doc: Document = window.document): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Contexto no seguro o permiso denegado: sigue el fallback.
  }
  try {
    const area = doc.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    doc.body.appendChild(area);
    area.select();
    const ok = doc.execCommand("copy");
    doc.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
