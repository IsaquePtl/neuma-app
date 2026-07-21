"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type AccentKey = "coral" | "blue" | "periwinkle" | "lavender" | "orange";

export const ACCENTS: Record<AccentKey, { label: string; hex: string }> = {
  coral: { label: "Coral", hex: "#fa4f33" },
  orange: { label: "Ambar", hex: "#f4923f" },
  lavender: { label: "Lavanda", hex: "#b79ce8" },
  periwinkle: { label: "Pervinca", hex: "#7b89f0" },
  blue: { label: "Azul", hex: "#3b74d6" },
};

const STORAGE_KEY = "neuma-accent";

type AccentContextValue = {
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
};

const AccentContext = createContext<AccentContextValue>({
  accent: "coral",
  setAccent: () => {},
});

function apply(accent: AccentKey) {
  const hex = ACCENTS[accent].hex;
  const root = document.documentElement;
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", hex);
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>("coral");

  useEffect(() => {
    const saved = (typeof window !== "undefined" &&
      (localStorage.getItem(STORAGE_KEY) as AccentKey | null)) as
      | AccentKey
      | null;
    if (saved && saved in ACCENTS) {
      setAccentState(saved);
      apply(saved);
    }
  }, []);

  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    apply(a);
    localStorage.setItem(STORAGE_KEY, a);
  }, []);

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  return useContext(AccentContext);
}
