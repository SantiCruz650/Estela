/* Formateo de tamaños para la tarjeta de respuesta. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = 1024;
  if (bytes < kb * kb) {
    return `${(bytes / kb).toFixed(1)} kB`;
  }
  return `${(bytes / (kb * kb)).toFixed(1)} MB`;
}
