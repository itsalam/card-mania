import React, { createContext, useContext } from "react";
import { create } from "zustand";

type OverlayState = {
  hiddenId: string | undefined;
  setHiddenId: (id: string | undefined) => void;
  setOverlayCloseCb: (onOverlayClose: () => void) => void;
  _onOverlayCloseCb: () => void;
};

export const useOverlayStore = create<OverlayState>((set, get) => ({
  hiddenId: undefined,
  setHiddenId: (id) => set({ hiddenId: id }),
  _onOverlayCloseCb: () => {},
  setOverlayCloseCb: (onOverlayClose) =>
    set({ _onOverlayCloseCb: onOverlayClose }),
}));

const OverlayContext = createContext<OverlayState | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const value = useOverlayStore();
  return <OverlayContext.Provider value={value as OverlayState}>{children}</OverlayContext.Provider>;
}

export function useOverlay() {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}