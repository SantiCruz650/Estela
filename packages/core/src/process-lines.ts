/* Decodificación de la salida del proceso hijo:
   TextDecoder streaming UTF-8 (un carácter partido entre chunks no se
   rompe), limpieza de códigos ANSI y separación por líneas.
   Puro: TextDecoder existe en node>=11 y en navegadores. */

export type ProcessStreamName = "stdout" | "stderr";

/** Línea de salida del hijo con la hora EXACTA del CLI al recibirla. */
export interface ProcessLineEntry {
  t: number;
  text: string;
  stream: ProcessStreamName;
}

/** Códigos CSI (\x1B[…m, \x1B[…K, \x1B[…G…) y escapes simples (\x1B[?]. */
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/** Quita códigos ANSI de la salida del hijo. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export interface SplitResult {
  /** Líneas completas (sin ANSI, sin vacías). */
  readonly lines: readonly string[];
  /** Texto decodificado tal cual (con ANSI y \r\n), para el echo original. */
  readonly decoded: string;
}

export interface ProcessLineSplitter {
  push: (chunk: Uint8Array) => SplitResult;
  /** Emite la última línea sin \n y libera el decodificador. */
  flush: () => SplitResult;
}

export function createProcessLineSplitter(): ProcessLineSplitter {
  const decoder = new TextDecoder("utf-8");
  let partial = "";

  function emitLines(text: string): string[] {
    const parts = (partial + text).split("\n");
    partial = parts.pop() ?? "";
    return parts
      .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
      .filter((line) => line.trim() !== "")
      .map((line) => stripAnsi(line));
  }

  return {
    push: (chunk) => {
      const decoded = decoder.decode(chunk, { stream: true });
      const lines = emitLines(decoded);
      return { lines, decoded };
    },
    flush: () => {
      const tail = partial + decoder.decode();
      partial = "";
      const clipped = tail.trim();
      const lines = clipped === "" ? [] : [stripAnsi(clipped)];
      return { lines, decoded: tail };
    },
  };
}

export interface ProcessOutputHandlerOptions {
  /** Reloj (inyectable para tests). */
  now: () => number;
  /** Cada línea completa, con hora y stream. */
  onLine: (entry: ProcessLineEntry) => void;
  /** Texto decodificado tal como salió (con ANSI) para el echo original en terminal. */
  onDecoded?: (stream: ProcessStreamName, text: string) => void;
}

export interface ProcessOutputHandler {
  onData: (stream: ProcessStreamName, chunk: Uint8Array) => void;
  end: (stream: ProcessStreamName) => void;
}

/** Una instancia por proceso hijo; cada stream mantiene su propio estado. */
export function createProcessOutputHandler(options: ProcessOutputHandlerOptions): ProcessOutputHandler {
  const splitters = new Map<ProcessStreamName, ProcessLineSplitter>();
  function splitterFor(stream: ProcessStreamName): ProcessLineSplitter {
    const existing = splitters.get(stream);
    if (existing !== undefined) {
      return existing;
    }
    const created = createProcessLineSplitter();
    splitters.set(stream, created);
    return created;
  }
  return {
    onData: (stream, chunk) => {
      if (chunk.length === 0) {
        return;
      }
      const result = splitterFor(stream).push(chunk);
      options.onDecoded?.(stream, result.decoded);
      const t = options.now();
      for (const text of result.lines) {
        options.onLine({ t, text, stream });
      }
    },
    end: (stream) => {
      const result = splitterFor(stream).flush();
      options.onDecoded?.(stream, result.decoded);
      const t = options.now();
      for (const text of result.lines) {
        options.onLine({ t, text, stream });
      }
    },
  };
}
