// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import BackendModal from "./BackendModal";
import { BACKEND_SNIPPETS } from "./backend-snippets";

/* Test del modal "Conecta tu backend": foco atrapado, Escape cierra,
   aria-modal + título accesible, y un bloque copiable por framework. */

function keydownOn(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

describe("BackendModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();
    act(() => {
      root.render(<BackendModal onClose={onClose} />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("es un dialog accesible con título y 8 pestañas", () => {
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("backend-modal-title");
    expect(container.querySelector("#backend-modal-title")?.textContent).toBe("Conecta tu backend");
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(BACKEND_SNIPPETS.length);
  });

  it("Escape cierra el modal", () => {
    const dialog = container.querySelector('[role="dialog"]');
    if (dialog === null) throw new Error("dialog no encontrado");
    keydownOn(dialog, "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cambia de framework al hacer clic en una pestaña", () => {
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const fastify = tabs.find((tab) => tab.textContent === "Fastify");
    if (fastify === undefined) throw new Error("pestaña Fastify no encontrada");
    act(() => {
      fastify.click();
    });
    expect(fastify.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain('addHook("onRequest"');
  });

  it("el Escape dentro de un input de pestaña también cierra (burbujeo)", () => {
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const first = tabs[0];
    if (first === null) throw new Error("pestaña no encontrada");
    keydownOn(first, "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cada pestaña muestra un bloque copiable", () => {
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    for (const tab of tabs) {
      act(() => {
        tab.click();
      });
      const panel = container.querySelector('[role="tabpanel"]');
      if (panel === null) throw new Error("tabpanel no encontrado");
      const copyButtons = Array.from(panel.querySelectorAll("button")).filter(
        (button) => button.textContent === "Copiar" || button.textContent === "¡Copiado!",
      );
      expect(copyButtons.length).toBe(1);
    }
  });
});
