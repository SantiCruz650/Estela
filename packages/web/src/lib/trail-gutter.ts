/* Primera/última fila visibles de un rastro: la línea vertical del gutter
   une la primera y la última fila del rastro cuando ambas exponen medio
   trazo (top/bottom 50%). */

export interface TrailSpan {
  first: number;
  last: number;
}

/** Índices de la primera y última fila que pertenecen al rastro (o null). */
export function trailSpan(memberships: readonly boolean[]): TrailSpan | null {
  let first = -1;
  let last = -1;
  for (let i = 0; i < memberships.length; i += 1) {
    if (memberships[i]) {
      if (first === -1) {
        first = i;
      }
      last = i;
    }
  }
  return first === -1 ? null : { first, last };
}
