import { create } from "zustand";
import type { HttpRequestInput, HttpResponseInfo } from "@devtool/core";
import type { HistoryEntry } from "./db";

/* Estado compartido de la respuesta mostrada y de la carga desde historial:
   RequestRunner la escribe; el historial la escribe al hacer clic. */

export interface SelectionPayload {
  entry: HistoryEntry;
  nonce: number;
}

type ResponseState = {
  response: HttpResponseInfo | null;
  input: HttpRequestInput | null;
  /** Último elemento de historial seleccionado (nonce para re-cargar el mismo). */
  selection: SelectionPayload | null;
  setResponse: (response: HttpResponseInfo | null, input: HttpRequestInput | null) => void;
  selectEntry: (entry: HistoryEntry) => void;
};

let nonceCounter = 0;

export const useResponseStore = create<ResponseState>((set) => ({
  response: null,
  input: null,
  selection: null,
  setResponse: (response, input) => set({ response, input }),
  selectEntry: (entry) => {
    nonceCounter += 1;
    set({ selection: { entry, nonce: nonceCounter } });
  },
}));
