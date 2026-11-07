/* Aviso amigable para la URL del request (B-10): NO bloquea el envío, solo
   pone un texto pequeño debajo de la FILA cuando parece que al pegar la URL
   quedó mal. Los espacios del inicio/fin NO avisan: al enviar la URL se
   recorta (trim). Puro y testable. */

export function urlNotice(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") {
    return null;
  }
  // trim() ya quitó los extremos: cualquier espacio que quede quedó EN MEDIO.
  if (/\s/u.test(trimmed)) {
    return "Tu URL tiene espacios en medio: revisa que sea solo el enlace.";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return "Empieza con http:// o https:// para que el servidor sepa a dónde llamar.";
  }
  return null;
}
