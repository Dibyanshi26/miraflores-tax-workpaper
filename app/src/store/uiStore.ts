import { create } from "zustand";

interface UiState {
  openTraceKey: string | null;
  openTrace: (lineKey: string) => void;
  closeTrace: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  openTraceKey: null,
  openTrace: (lineKey) => set({ openTraceKey: lineKey }),
  closeTrace: () => set({ openTraceKey: null }),
}));
