import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";

/** Header único de autenticación del CLI local (espejo de packages/cli). */
export const CLI_TOKEN_HEADER = "X-Estela-Token";

export interface CliTailPayload {
  size: number;
  truncated: boolean;
  data: string;
}

/**
 * Ejecuta la request a través del proxy del CLI local (POST /api/proxy).
 * Lanza si el proxy responde con error HTTP (p. ej. token u origen inválidos):
 * el caller puede caer en fallback a fetch directo.
 */
export async function executeRequestViaCli(
  input: HttpRequestInput,
  token: string,
  signal?: AbortSignal,
): Promise<HttpResponseInfo> {
  if (signal?.aborted === true) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  let response: Response;
  try {
    response = await fetch("/api/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CLI_TOKEN_HEADER]: token,
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "No se pudo contactar con el CLI local (¿sigue corriendo `npx @estela-dev/cli`?).",
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`El proxy del CLI rechazó la request (HTTP ${response.status}).`);
  }
  return (await response.json()) as HttpResponseInfo;
}

/**
 * Hace tail vía el CLI local (GET /api/tail). Mismo protocolo que RemoteLogSource.
 * Lanza si el CLI responde con error HTTP.
 */
export async function fetchTailViaCli(offset: number, token: string): Promise<CliTailPayload> {
  const response = await fetch(`/api/tail?offset=${offset}`, {
    headers: { [CLI_TOKEN_HEADER]: token },
  });
  if (!response.ok) {
    throw new Error(`tail_error_${response.status}`);
  }
  return (await response.json()) as CliTailPayload;
}
