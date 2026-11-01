// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { parseLine, type LogLine, type RequestRecord } from "@devtool/core";
import CorrelationHint from "./CorrelationHint";
import { useCorrelationStore } from "../lib/correlation-store";
import { useSourceStore } from "../lib/source-state";

/* Test del aviso (punto 7): fuente con logs reales, 2+ requests y ninguna
   línea segura → muestra el aviso con "Ver cómo"; se cierra y se recuerda
   en localStorage ("estela.idHintDismissed"). */

const reqA: RequestRecord = {
  requestId: "req-a",
  method: "GET",
  url: "http://localhost/api/a",
  statusCode: 200,
  startedAt: 1000,
  durationMs: 10,
};
const reqB: RequestRecord = {
  requestId: "req-b",
  method: "POST",
  url: "http://localhost/api/b",
  statusCode: 200,
  startedAt: 2000,
  durationMs: 10,
};

function plainLines(): LogLine[] {
  return [parseLine("[2026-01-01T00:00:01.050Z] INFO creando usuario", "app.log")];
}

function setStateFarFromWindow(): void {
  useSourceStore.setState({ source: "remote", running: true });
  useCorrelationStore.setState({
    requests: [reqA, reqB],
    buffer: plainLines(),
    selectedRequestId: null,
  });
}

describe("CorrelationHint", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderHint(): void {
    act(() => {
      root.render(<CorrelationHint />);
    });
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    localStorage.removeItem("estela.idHintDismissed");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    useCorrelationStore.setState({ requests: [], buffer: [], selectedRequestId: null });
    useSourceStore.setState({ source: "demo", running: false });
  });

  it("muestra el aviso cuando la condición del punto 7 se cumple", () => {
    setStateFarFromWindow();
    renderHint();
    expect(container.textContent).toContain("Tus logs no incluyen el ID de cada request");
    expect(container.textContent).toContain("Ver cómo");
  });

  it("no muestra el aviso en la demo o con pocas requests", () => {
    useSourceStore.setState({ source: "demo", running: true });
    useCorrelationStore.setState({ requests: [reqA, reqB], buffer: plainLines() });
    renderHint();
    expect(container.textContent).not.toContain("Tus logs no incluyen el ID");

    useSourceStore.setState({ source: "remote", running: true });
    useCorrelationStore.setState({ requests: [reqA], buffer: plainLines() });
    act(() => {
      root.render(<CorrelationHint />);
    });
    expect(container.textContent).not.toContain("Tus logs no incluyen el ID");
  });

  it("el botón Ver cómo abre el modal Conecta tu backend", () => {
    setStateFarFromWindow();
    renderHint();
    const buttons = Array.from(container.querySelectorAll("button"));
    const verComo = buttons.find((button) => button.textContent === "Ver cómo");
    if (verComo === undefined) throw new Error("botón Ver cómo no encontrado");
    act(() => {
      verComo.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Conecta tu backend");
  });

  it("cerrar el aviso se recuerda en localStorage (estela.idHintDismissed)", () => {
    setStateFarFromWindow();
    renderHint();
    const buttons = Array.from(container.querySelectorAll("button"));
    const closers = buttons.filter((button) => button.getAttribute("aria-label") === "Cerrar aviso");
    expect(closers.length).toBeGreaterThan(0);
    act(() => {
      closers[0].click();
    });
    expect(localStorage.getItem("estela.idHintDismissed")).toBe("1");
    expect(container.textContent).not.toContain("Tus logs no incluyen el ID");
  });
});
