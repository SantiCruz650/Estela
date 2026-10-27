import { describe, expect, it } from "vitest";
import { cleanLogMessage } from "./log-message";

describe("cleanLogMessage", () => {
  it("quita el timestamp, el prefijo de nivel que coincide con el badge y el sufijo req=<id>", () => {
    const message = cleanLogMessage(
      "[2026-10-26T10:00:00.123Z] INFO → GET /api/users req=11111111-2222-4abc-8abc-123456789abc",
      "info",
      "11111111-2222-4abc-8abc-123456789abc",
    );
    expect(message).toBe("→ GET /api/users");
  });

  it("quita requestId=<id> como variante de sufijo y el prefijo de nivel WARN", () => {
    const message = cleanLogMessage(
      "[2026-10-26T10:00:00.123Z] WARN query lenta req=11111111-2222-4abc-8abc-123456789abc",
      "warn",
      "11111111-2222-4abc-8abc-123456789abc",
    );
    expect(message).toBe("query lenta");
  });

  it("conserva el prefijo de nivel cuando NO coincide con el badge", () => {
    // La línea dice INFO pero el parser detectó debug (el badge mostrará DEBUG).
    const message = cleanLogMessage("INFO alcanzado por el log de debug", "debug", undefined);
    expect(message).toBe("INFO alcanzado por el log de debug");
  });

  it("conserva el prefijo del nivel level=error cuando el texto empieza con DEBUG", () => {
    expect(cleanLogMessage("DEBUG solo visible con error de conexión", "error", undefined)).toBe(
      "DEBUG solo visible con error de conexión",
    );
  });

  it("conserva req=<id> cuando el id NO es el de la columna", () => {
    const message = cleanLogMessage(
      "trace req=11111111-2222-4abc-8abc-123456789abc",
      "info",
      "99999999-9999-4999-8999-999999999999",
    );
    expect(message).toBe("trace req=11111111-2222-4abc-8abc-123456789abc");
  });

  it("conserva req=<id> cuando no hay id de correlación en la línea", () => {
    expect(cleanLogMessage("pool active req=11111111-2222-4abc-8abc-123456789abc", "info", undefined)).toBe(
      "pool active req=11111111-2222-4abc-8abc-123456789abc",
    );
  });

  it("no toca mensajes con req= sin id UUID válido en el sufijo exacto al final", () => {
    // El id de la columna termina en otra cosa: el texto se queda igual.
    expect(cleanLogMessage("resumen req=11111111-2222-4abc-8abc-123456789abc fin", "info", "11111111-2222-4abc-8abc-123456789abc")).toBe(
      "resumen req=11111111-2222-4abc-8abc-123456789abc fin",
    );
  });

  it("funciona sin timestamp ni nivel que limpiar", () => {
    expect(cleanLogMessage("healthcheck OK", "debug", undefined)).toBe("healthcheck OK");
    expect(cleanLogMessage("[2026-10-26T10:00:00.123Z] healthcheck OK", "debug", undefined)).toBe("healthcheck OK");
  });
});
