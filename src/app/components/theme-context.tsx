/**
 * @file theme-context.tsx
 * @description Context provider untuk dark/light mode.
 *
 * Menyimpan preferensi tema di localStorage (key: "oe-theme").
 * Menambah/hapus class "dark" di `<html>` untuk Tailwind CSS dark mode.
 * Diakses oleh komponen manapun melalui hook `useTheme()`.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("oe-theme") as Theme) || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("oe-theme", theme);
  }, [theme]);

  /** Toggle antara dark dan light mode. */
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

/** Hook untuk mengakses tema saat ini dan fungsi toggle dari komponen manapun. */
export const useTheme = () => useContext(ThemeContext);
