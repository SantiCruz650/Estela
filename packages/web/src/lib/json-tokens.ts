/* Tokenizador JSON propio: parte un string JSON ya validado en tokens
   tipados para colorear la respuesta. El componente mapea cada kind a un
   <span> con su color. */

export type JsonTokenKind =
  | "key"       // nombre de propiedad: "..."
  | "string"    // valor string
  | "number"
  | "boolean"   // true / false
  | "null"      // null
  | "rest";     // llaves, corchetes, dos puntos, comas, espacios

export interface JsonToken {
  kind: JsonTokenKind;
  value: string;
}

const WORD_RE = /(true|false|null)/y;
const NUMBER_RE = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/** Tokeniza JavaScript ya serializado (JSON válido garantizado por el caller). */
export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"') {
      let j = i + 1;
      let escaped = false;
      while (j < json.length) {
        if (json[j] === "\\") {
          escaped = !escaped;
        } else if (json[j] === '"' && !escaped) {
          break;
        } else {
          escaped = false;
        }
        j += 1;
      }
      const raw = json.slice(i, j + 1);
      let k = j + 1;
      while (k < json.length && /[\s]/.test(json[k])) {
        k += 1;
      }
      const kind: JsonTokenKind = json[k] === ":" ? "key" : "string";
      tokens.push({ kind, value: raw });
      i = j + 1;
      continue;
    }
    if (/[\d-]/.test(ch)) {
      NUMBER_RE.lastIndex = i;
      const m = NUMBER_RE.exec(json);
      if (m !== null && m[0] !== "-") {
        tokens.push({ kind: "number", value: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (/[tfn]/.test(ch)) {
      WORD_RE.lastIndex = i;
      const m = WORD_RE.exec(json);
      if (m !== null) {
        const kind: JsonTokenKind = m[0] === "null" ? "null" : "boolean";
        tokens.push({ kind, value: m[0] });
        i += m[0].length;
        continue;
      }
    }
    // estructura: { } [ ] , : y espacios en blanco
    tokens.push({ kind: "rest", value: ch });
    i += 1;
  }
  return tokens;
}

/** Tokeniza el body de una respuesta formateado con JSON.stringify(parsed, null, 2);
    si no es JSON válido devuelve null. */
export function tokenizeBody(bodyText: string): JsonToken[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  return tokenizeJson(JSON.stringify(parsed, null, 2));
}
