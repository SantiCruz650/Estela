/* Plurales en español para la barra del rastro (puros, testables). */

export function pluralSecureLines(n: number): string {
  return n === 1 ? "1 línea segura" : `${n} líneas seguras`;
}

export function pluralProbableLines(n: number): string {
  return n === 1 ? "1 probable" : `${n} probables`;
}

/** Plurales internos (no necesarios como API pública). */
function pluralTrailErrors(n: number): string {
  return n === 1 ? "1 error" : `${n} errores`;
}

function pluralTrailWarns(n: number): string {
  return n === 1 ? "1 aviso" : `${n} avisos`;
}

/**
 * Frase de problemas del rastro (B-09): jamás "0 avisos" ni "0 errores".
 * Con cero de ambos se nombra lo que NO pasó: "sin errores ni avisos".
 */
export function trailIssuesPhrase(errors: number, warns: number): string {
  if (errors === 0 && warns === 0) {
    return "sin errores ni avisos";
  }
  if (errors === 0) {
    return `sin errores · ${pluralTrailWarns(warns)}`;
  }
  if (warns === 0) {
    return `${pluralTrailErrors(errors)} · sin avisos`;
  }
  return `${pluralTrailErrors(errors)} · ${pluralTrailWarns(warns)}`;
}
