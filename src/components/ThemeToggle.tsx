"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

// ------------------------------------------------------------
// Controles de modo oscuro / claro.
//  - ThemeIconButton: botón compacto sol/luna para el encabezado.
//  - ThemeSetting: tarjeta con switch "Modo oscuro" para Perfil.
// Ambos usan next-themes (clase .dark en <html>); `mounted`
// evita desajustes de hidratación (el tema se resuelve en el
// cliente antes del primer render real).
// ------------------------------------------------------------

function useThemeState() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Antes de montar asumimos oscuro (el default de la app).
  const dark = mounted ? resolvedTheme === "dark" : true;
  return { dark, mounted, setTheme };
}

export function ThemeIconButton() {
  const { dark, mounted, setTheme } = useThemeState();
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

export function ThemeSetting() {
  const { dark, mounted, setTheme } = useThemeState();
  return (
    <Card className="border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            {mounted && !dark ? (
              <Sun className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            Modo oscuro
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Texto blanco sobre fondo negro, cómodo bajo el sol. Desactívalo para el modo claro.
          </p>
        </div>
        <Switch
          checked={dark}
          onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
          aria-label="Activar o desactivar el modo oscuro"
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>
    </Card>
  );
}
