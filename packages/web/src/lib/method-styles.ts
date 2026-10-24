/* Colores de método HTTP: GET cian, POST ámbar, PUT/PATCH violeta,
   DELETE rosa; resto tenue. Devuelve clases Tailwind. */

const METHOD_CLASSES: Record<string, string> = {
  GET: "text-accent",
  POST: "text-warn",
  PUT: "text-violet",
  PATCH: "text-violet",
  DELETE: "text-err",
};

const FALLBACK_CLASS = "text-dim";

export function methodColorClass(method: string): string {
  return METHOD_CLASSES[method.toUpperCase()] ?? FALLBACK_CLASS;
}
