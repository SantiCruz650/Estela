/* Plurales en español para la barra del rastro (puros, testables). */

export function pluralSecureLines(n: number): string {
  return n === 1 ? "1 línea segura" : `${n} líneas seguras`;
}

export function pluralProbableLines(n: number): string {
  return n === 1 ? "1 probable" : `${n} probables`;
}

export function pluralTrailErrors(n: number): string {
  if (n === 0) {
    return "sin errores";
  }
  return n === 1 ? "1 error" : `${n} errores`;
}

export function pluralTrailWarns(n: number): string {
  return n === 1 ? "1 aviso" : `${n} avisos`;
}
