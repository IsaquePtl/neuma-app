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

export type BgThemeKey = "crepusculo" | "neon";

export const BG_THEMES: Record<BgThemeKey, { label: string }> = {
  crepusculo: { label: "Tema Crepúsculo" },
  neon: { label: "Tema Néon" },
};

const STORAGE_KEY = "neuma-accent";
const BG_STORAGE_KEY = "neuma-bg-theme";

type AccentContextValue = {
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  bgTheme: BgThemeKey;
  setBgTheme: (t: BgThemeKey) => void;
};

const AccentContext = createContext<AccentContextValue>({
  accent: "coral",
  setAccent: () => {},
  bgTheme: "crepusculo",
  setBgTheme: () => {},
});

function apply(accent: AccentKey) {
  const hex = ACCENTS[accent].hex;
  const root = document.documentElement;
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", hex);
}

function applyBgTheme(theme: BgThemeKey) {
  document.documentElement.setAttribute("data-neuma-bg", theme);
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentKey>("coral");
  const [bgTheme, setBgThemeState] = useState<BgThemeKey>("crepusculo");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AccentKey | null;
    if (saved && saved in ACCENTS) {
      setAccentState(saved);
      apply(saved);
    }

    const savedBg = localStorage.getItem(BG_STORAGE_KEY);
    if (savedBg === "neon" || savedBg === "crepusculo") {
      setBgThemeState(savedBg);
      applyBgTheme(savedBg);
    } else {
      applyBgTheme("crepusculo");
    }
  }, []);

  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    apply(a);
    localStorage.setItem(STORAGE_KEY, a);
  }, []);

  const setBgTheme = useCallback((t: BgThemeKey) => {
    setBgThemeState(t);
    applyBgTheme(t);
    localStorage.setItem(BG_STORAGE_KEY, t);
  }, []);

  return (
    <AccentContext.Provider value={{ accent, setAccent, bgTheme, setBgTheme }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  return useContext(AccentContext);
}

export function useBgTheme() {
  const { bgTheme, setBgTheme } = useContext(AccentContext);
  return { bgTheme, setBgTheme };
}
