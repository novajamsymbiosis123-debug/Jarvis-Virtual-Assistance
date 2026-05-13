"use client";

import "../styles/globals.css";
import { useState, useEffect } from "react";
import { AuthProvider } from "../lib/auth";

export default function RootLayout({ children }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jarvis_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored === "dark" || (!stored && prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("jarvis_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Jarvis AI Assistant</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Production AI voice assistant" />
      </head>
      <body className="bg-surface-50 text-surface-900 transition-colors duration-300">
        <AuthProvider>
          <ThemeContext.Provider value={{ dark, setDark }}>
            {children}
          </ThemeContext.Provider>
        </AuthProvider>
      </body>
    </html>
  );
}

import { createContext, useContext } from "react";
export const ThemeContext = createContext({ dark: false, setDark: () => {} });
export const useTheme = () => useContext(ThemeContext);
