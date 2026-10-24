import { create } from "zustand";

/* Fuente activa del panel de logs: se comparte con el header (indicador de
   conexión) y con el arranque automático de la demo. */

export type SourceId = "demo" | "file" | "remote";

type SourceState = {
  source: SourceId;
  running: boolean;
  setSource: (source: SourceId) => void;
  setRunning: (running: boolean) => void;
};

export const useSourceStore = create<SourceState>((set) => ({
  source: "demo",
  running: false,
  setSource: (source) => set({ source }),
  setRunning: (running) => set({ running }),
}));
