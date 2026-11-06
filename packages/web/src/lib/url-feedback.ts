/* Aviso amigable para la URL del request (B-10): NO bloquea el envío, solo
   pone un texto pequeño debajo del campo cuando parece que al pegar la URL
   quedó mal. Puro y testable. */

export function urlNotice(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") {
    return null;
  }
  if (/\s/u.test(trimmed) || trimmed !== url) {
    return "Tu URL tiene espacios o quedó incompleta: revisa que sea solo el enlace.";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return "Empieza con http:// o https:// para que el servidor sepa a dónde llamar.";
  }
  return null;
}
