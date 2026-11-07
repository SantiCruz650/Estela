// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import RequestForm from "./RequestForm";
import type { HttpRequestInput } from "@devtool/core";

/* Test del atajo Ctrl/Cmd + Enter: con el foco dentro del formulario
   (URL, header o body) el keydown burbujea al contenedor y dispara send(). */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function keydownOn(target: Element, init: { key: string; ctrlKey?: boolean; metaKey?: boolean }): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }),
  );
}

describe("RequestForm — atajo Ctrl/Cmd + Enter", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSend: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  function renderForm(): void {
    act(() => {
      root.render(<RequestForm onSend={onSend} onCancel={onCancel} sending={false} />);
    });
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSend = vi.fn();
    onCancel = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("el atajo envía el request con el foco en la URL (Ctrl)", () => {
    renderForm();
    const url = container.querySelector<HTMLInputElement>("#req-url");
    if (url === null) throw new Error("input #req-url no encontrado");
    url.focus();
    keydownOn(url, { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
    const input = onSend.mock.calls[0][0] as HttpRequestInput;
    expect(input.method).toBe("GET");
    expect(input.url).toBe("http://localhost:3000/api/users");
  });

  it("el atajo envía con el foco en un input de header (Ctrl)", () => {
    renderForm();
    const headerKey = container.querySelector<HTMLInputElement>('input[placeholder="Header-Name"]');
    if (headerKey === null) throw new Error("input de header no encontrado");
    headerKey.focus();
    keydownOn(headerKey, { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("el atajo envía con el foco en el body (Cmd en macOS)", () => {
    renderForm();
    const url = container.querySelector<HTMLInputElement>("#req-url");
    if (url === null) throw new Error("input #req-url no encontrado");
    url.focus();
    // Cambiar a POST (setter nativo + change, técnica de value tracker de React)
    // y abrir la pestaña Body para que aparezca el textarea.
    const select = container.querySelector<HTMLSelectElement>("#req-method");
    if (select === null) throw new Error("select #req-method no encontrado");
    const set = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;
    act(() => {
      set?.call(select, "POST");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const bodyTab = tabs.find((b) => b.textContent === "Body");
    if (bodyTab === undefined) throw new Error("pestaña Body no encontrada");
    act(() => {
      bodyTab.click();
    });
    const body = container.querySelector<HTMLTextAreaElement>("#req-body");
    if (body === null) throw new Error("textarea #req-body no encontrado");
    body.focus();
    keydownOn(body, { key: "Enter", metaKey: true });
    const sent = onSend.mock.calls[0]?.[0] as HttpRequestInput | undefined;
    expect(sent?.method).toBe("POST");
  });

  it("Enter sin Ctrl/Cmd NO envía", () => {
    renderForm();
    const url = container.querySelector<HTMLInputElement>("#req-url");
    if (url === null) throw new Error("input #req-url no encontrado");
    url.focus();
    keydownOn(url, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('el botón Enviar anuncia el atajo: title="Ctrl + Enter" y aria-keyshortcuts', () => {
    renderForm();
    const buttons = Array.from(container.querySelectorAll("button"));
    const sendButton = buttons.find((b) => b.textContent === "Enviar");
    if (sendButton === undefined) throw new Error("botón Enviar no encontrado");
    expect(sendButton.getAttribute("title")).toBe("Ctrl + Enter");
    expect(sendButton.getAttribute("aria-keyshortcuts")).toBe("Control+Enter");
  });

  it("la fila X-Request-ID dice 'envío' con tilde (no sin tilde)", () => {
    renderForm();
    expect(container.textContent).toContain("uno nuevo en cada envío");
    // "envio" (sin tilde) no es substring de "envío": si apareciera el typo, falla.
    expect(container.textContent).not.toContain("envio");
  });
});

describe("RequestForm — trim de la URL y aviso NO bloqueante", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSend: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  function renderForm(): void {
    act(() => {
      root.render(<RequestForm onSend={onSend} onCancel={onCancel} sending={false} />);
    });
  }

  function urlInput(): HTMLInputElement {
    const url = container.querySelector<HTMLInputElement>("#req-url");
    if (url === null) throw new Error("input #req-url no encontrado");
    return url;
  }

  /** Cambia el value del input con la técnica del value tracker de React. */
  function setUrl(value: string): void {
    const url = urlInput();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(url, value);
      url.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function sendButton(): HTMLButtonElement {
    const buttons = Array.from(container.querySelectorAll("button"));
    const found = buttons.find((b) => b.textContent === "Enviar");
    if (found === undefined) throw new Error("botón Enviar no encontrado");
    return found;
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSend = vi.fn();
    onCancel = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("al enviar recorta los espacios del inicio y del final (trim)", () => {
    renderForm();
    setUrl("  http://localhost:3000/api/trim  ");
    act(() => {
      sendButton().click();
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    const input = onSend.mock.calls[0][0] as HttpRequestInput;
    expect(input.url).toBe("http://localhost:3000/api/trim");
    // El input y el storage quedan con la URL recortada.
    expect(urlInput().value).toBe("http://localhost:3000/api/trim");
    expect(localStorage.getItem("estela.requestUrl")).toBe("http://localhost:3000/api/trim");
  });

  it("al cargar desde localStorage recorta los espacios de los extremos", () => {
    localStorage.setItem("estela.requestUrl", "  http://localhost:3000/api/lazy  ");
    renderForm();
    expect(urlInput().value).toBe("http://localhost:3000/api/lazy");
  });

  it("extremos con espacios: SIN aviso; espacios en medio o sin esquema: avisa", () => {
    renderForm();
    // Solo extremos: se recortan al enviar → no avisa.
    setUrl("  http://localhost:3000/api/x  ");
    expect(container.querySelector("#req-url-hint")).toBeNull();
    // Espacios EN MEDIO: avisa.
    setUrl("http://localhost:3000  /api/x");
    expect(container.querySelector("#req-url-hint")).not.toBeNull();
    // Sin esquema http:// o https://: avisa (aun con extremos recortables).
    setUrl(" localhost:3000/api/users ");
    expect(container.querySelector("#req-url-hint")).not.toBeNull();
    // URL bien formada: sin aviso otra vez.
    setUrl("http://localhost:3000/api/users");
    expect(container.querySelector("#req-url-hint")).toBeNull();
  });

  it("el aviso va DEBAJO de toda la fila (método + URL + Enviar), a ancho completo", () => {
    renderForm();
    setUrl("http://localhost:3000  /api/x");
    const hint = container.querySelector("#req-url-hint");
    if (hint === null) throw new Error("aviso #req-url-hint no encontrado");
    // Hermano inmediato DE LA FILA: nunca dentro de la columna de la URL.
    const row = hint.previousElementSibling;
    if (row === null) throw new Error("la fila de controles no es hermana del aviso");
    expect(row.className).toContain("items-end");
    expect(row.querySelector("#req-url")).not.toBeNull();
    expect(row.textContent).toContain("Enviar");
    // El aviso NO vive dentro de la fila (la fila no cambia con o sin aviso).
    expect(row.contains(hint)).toBe(false);
    expect(hint.parentElement?.className).toContain("flex-col");
  });
});
