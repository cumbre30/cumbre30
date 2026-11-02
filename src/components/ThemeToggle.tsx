"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncExternalStore } from "react";

// ------------------------------------------------------------
// Control de modo oscuro / claro: un único botón compacto
// sol/luna en el encabezado (presente en todas las pestañas).
// Usa next-themes (clase .dark en <html>). Para saber si ya
// hidratamos sin setState-en-efecto usamos useSyncExternalStore:
//   - snapshot del servidor: false (antes de montar)
//   - snapshot del cliente:  true  (componente montado)
// Así el primer render coincide con el HTML del servidor y
// luego el ícono se ajusta al tema real. La preferencia queda
// en localStorage ("cumbre30-theme") y funciona igual de bien
// offline en el APK.
// ------------------------------------------------------------

const emptySubscribe = () => () => {};

export function ThemeIconButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  // Antes de montar asumimos oscuro (el default de la app).
  const dark = mounted ? resolvedTheme !== "light" : true;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="h-8 w-8 text-muted-foreground"
    >
      {mounted ? (
        dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4 opacity-0" aria-hidden />
      )}
    </Button>
  );
}
