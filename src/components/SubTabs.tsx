"use client";

// ============================================================
// SubTabs — navegación de subsecciones dentro de una pantalla.
// Al hacer clic en una sección del menú, la pantalla muestra sus
// subsecciones como chips y SOLO el contenido de la activa.
// Mismo estilo que los chips de filtro de Mis viajes.
// ============================================================

import { Crown } from "lucide-react";

export type SubTabDef = { key: string; label: string; crown?: boolean };

export function SubTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: SubTabDef[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex gap-1.5" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[12px] font-semibold transition-colors ${
              on
                ? "border-emerald-700 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {t.crown && (
              <Crown
                className={`h-3 w-3 shrink-0 ${
                  on ? "text-amber-600 dark:text-amber-300" : "text-amber-600/60 dark:text-amber-300/60"
                }`}
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
