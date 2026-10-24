import { create } from "zustand";
import { Correlator, type CorrelationResult, type RequestRecord } from "@devtool/core";
import type { LogLine } from "@devtool/core";
import { TRAIL_PALETTE } from "./trail-colors";

const BUFFER_LIMIT = 5000;

/* Color de rastro asignado cíclicamente por orden de llegada del request.
   Se guarda aquí (index) y cualquier vista lo consulta por requestId. */

type CorrelationState = {
  requests: RequestRecord[];
  correlator: Correlator;
  selectedRequestId: string | null;
  /** Buffer completo de líneas ingeridas (para stats del rastro). */
  buffer: LogLine[];
  /** Color de rastro por requestId (índice en TRAIL_PALETTE). */
  trailColors: Record<string, number>;
  recordRequest: (request: RequestRecord) => void;
  ingest: (lines: LogLine[]) => void;
  selectRequest: (requestId: string | null) => void;
  getCorrelation: (requestId: string) => CorrelationResult | null;
  getTrailColorIndex: (requestId: string) => number;
};

export const useCorrelationStore = create<CorrelationState>((set, get) => {
  const correlator = new Correlator(2);

  return {
    requests: [],
    correlator,
    selectedRequestId: null,
    buffer: [],
    trailColors: {},
    recordRequest: (request) => {
      const state = get();
      const existing = state.trailColors[request.requestId];
      // Color cíclico por orden de llegada (sin color previo).
      const nextIndex = existing ?? Object.keys(state.trailColors).length % TRAIL_PALETTE.length;
      correlator.upsertRequest(request);
      set({
        requests: [request, ...state.requests.filter((item) => item.requestId !== request.requestId)].slice(0, 50),
        trailColors: { ...state.trailColors, [request.requestId]: nextIndex },
      });
    },
    ingest: (lines) => {
      correlator.ingestLines(lines);
      set((state) => ({
        buffer: [...state.buffer, ...lines].slice(-BUFFER_LIMIT),
      }));
    },
    selectRequest: (requestId) => {
      set({ selectedRequestId: requestId });
    },
    getCorrelation: (requestId) => correlator.correlate(requestId),
    getTrailColorIndex: (requestId) => {
      const existing = get().trailColors[requestId];
      if (existing !== undefined) {
        return existing;
      }
      // Request sin color (p. ej. cargado del historial): asigna por orden.
      const index = Object.keys(get().trailColors).length % TRAIL_PALETTE.length;
      set((state) => ({ trailColors: { ...state.trailColors, [requestId]: index } }));
      return index;
    },
  };
});
