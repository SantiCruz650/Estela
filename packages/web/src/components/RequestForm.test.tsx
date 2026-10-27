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
});
