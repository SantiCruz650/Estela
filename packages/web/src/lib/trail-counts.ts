/* Plurales en español para la barra del rastro (puros, testables). */

export function pluralTrailLines(n: number): string {
  return n === 1 ? "1 línea" : `${n} líneas`;
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
