/* Paleta de rastros: color por orden de llegada del request (cíclica).
   Cada color va acompañado de su tinte (mismo color con opacidad) para
   fondos y líneas del "rastro" en historial, respuesta y logs. */

export const TRAIL_PALETTE: readonly string[] = [
  "#22D3EE",
  "#F5B83D",
  "#FB7185",
  "#A78BFA",
  "#34D399",
  "#7DB4FF",
];

export const TRAIL_TINT_ALPHA = 0.1;
export const TRAIL_LINE_ALPHA = 0.55;

/** #RRGGBB → rgba(r,g,b,a). Lanza con hex inválido (fail-fast en dev). */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Color hex inválido: ${hex}`);
  }
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Color principal del rastro n (cíclico). */
export function trailColor(index: number): string {
  const len = TRAIL_PALETTE.length;
  return TRAIL_PALETTE[((index % len) + len) % len];
}

/** Tinte del color del rastro n con alfa dado (fondo/lineas 9-10%). */
export function trailTint(index: number, alpha: number = TRAIL_TINT_ALPHA): string {
  return hexToRgba(trailColor(index), alpha);
}
