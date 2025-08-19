"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface FocusModeContextValue {
  focusMode: boolean;
  toggleFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextValue | undefined>(undefined);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("focus-mode", focusMode);
  }, [focusMode]);

  function toggleFocusMode() {
    setFocusMode((prev) => !prev);
  }

  return <FocusModeContext.Provider value={{ focusMode, toggleFocusMode }}>{children}</FocusModeContext.Provider>;
}

export function useFocusMode() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error("useFocusMode must be used within a FocusModeProvider");
  }
  return ctx;
}
