"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// ------------------------------------------------------------
// Tema de la app: oscuro por defecto (diseño original, texto
// blanco) y claro opcional. Se controla con el switch de la
// pestaña Perfil y el botón sol/luna del encabezado; la
// preferencia se guarda en localStorage ("cumbre30-theme") y
// funciona igual de bien offline en el APK.
// ------------------------------------------------------------
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="cumbre30-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
