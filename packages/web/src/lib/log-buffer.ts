import { create } from "zustand";
import type { LogLine } from "@devtool/core";

/* Estado del panel de logs: la lista visible se congela al pausar aunque el
   buffer interno sigue acumulando; al reanudar se vuelca todo de golpe. */

const LINE_LIMIT = 2000;

type LogLineState = {
  lines: LogLine[];
  /** Líneas acumuladas mientras la vista está pausada. */
  pending: LogLine[];
  paused: boolean;
  sourceRunning: boolean;
  appendLines: (newLines: LogLine[]) => void;
  clearLines: () => void;
  setPaused: (paused: boolean) => void;
  resume: () => void;
  setSourceRunning: (running: boolean) => void;
};

export const useLogLineStore = create<LogLineState>((set) => ({
  lines: [],
  pending: [],
  paused: false,
  sourceRunning: false,
  appendLines: (newLines) => {
    if (newLines.length === 0) {
      return;
    }
    set((state) => {
      if (state.paused) {
        // En pausa: el buffer sigue; la vista NO cambia hasta reanudar.
        return { pending: [...state.pending, ...newLines].slice(-LINE_LIMIT) };
      }
      return { lines: [...state.lines, ...newLines].slice(-LINE_LIMIT) };
    });
  },
  clearLines: () => set({ lines: [], pending: [] }),
  setPaused: (paused) => set({ paused }),
  resume: () =>
    set((state) => ({
      paused: false,
      lines: [...state.lines, ...state.pending].slice(-LINE_LIMIT),
      pending: [],
    })),
  setSourceRunning: (running) => set({ sourceRunning: running }),
}));
