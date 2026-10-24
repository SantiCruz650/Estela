/* Generación de cURL para "Copiar como cURL": método, URL, headers (con
   los mismos redactados que el historial → [redacted]) y body. */

import type { HttpRequestInput } from "@devtool/core";
import { redactHeaders } from "./db";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function toCurl(input: HttpRequestInput): string {
  const headers = redactHeaders(input.headers) ?? {};
  const parts: string[] = ["curl"];
  const upper = input.method.toUpperCase();
  if (!["GET", "HEAD"].includes(upper)) {
    parts.push("-X", upper);
  }
  for (const [key, value] of Object.entries(headers)) {
    parts.push("-H", shellQuote(`${key}: ${value}`));
  }
  if (input.body !== undefined && input.body !== "") {
    parts.push("--data", shellQuote(input.body));
  }
  parts.push(shellQuote(input.url));
  return parts.join(" ");
}
