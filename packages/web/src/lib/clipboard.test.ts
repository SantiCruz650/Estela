import { describe, expect, it } from "vitest";
import { copyText } from "./clipboard";

interface FakeArea {
  value: string;
  readonly style: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
  select: () => void;
}

interface FakeDoc {
  readonly body: {
    appendChild: (node: FakeArea) => void;
    removeChild: (node: FakeArea) => void;
  };
  createElement: (tag: string) => FakeArea;
  execCommand: (cmd: string) => boolean;
}

/* En Node (>=20.19) existe `navigator` pero no `navigator.clipboard`, así que
   copyText entra directo al fallback execCommand con el documento inyectado:
   no hace falta stubear la API del navegador. */
function makeFakeDoc(execResult: boolean): { doc: FakeDoc; removed: FakeArea[] } {
  const created: FakeArea[] = [];
  const removed: FakeArea[] = [];
  const doc: FakeDoc = {
    body: {
      appendChild: (node) => {
        created.push(node);
      },
      removeChild: (node) => {
        removed.push(node);
      },
    },
    createElement: () => {
      return {
        value: "",
        style: {},
        setAttribute: () => {
          // noop
        },
        select: () => {
          // noop
        },
      };
    },
    execCommand: (cmd) => {
      expect(cmd).toBe("copy");
      return execResult;
    },
  };
  void created;
  return { doc, removed };
}

describe("copyText", () => {
  it("usa el fallback execCommand cuando clipboard API no está disponible", async () => {
    const { doc, removed } = makeFakeDoc(true);
    await expect(copyText("npx @estela-dev/cli", doc as unknown as Document)).resolves.toBe(true);
    expect(removed).toHaveLength(1);
  });

  it("reporta false si el fallback también falla", async () => {
    const { doc } = makeFakeDoc(false);
    await expect(copyText("npx @estela-dev/cli", doc as unknown as Document)).resolves.toBe(false);
  });
});
