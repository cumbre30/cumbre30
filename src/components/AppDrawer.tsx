"use client";

// ============================================================
// Menú lateral del rediseño — 4 zonas (brief §1):
//   CUMBRE30 PRO · Mi actividad · Cuenta · Plan actual
// Cuenta consolida todo lo del ciclista: perfil, amigos,
// pagos y suscripciones, configuración y ayuda.
// Desliza desde la izquierda; el fondo cierra. Sin decoración
// extra: jerarquía clara y agrupación por propósito.
// ============================================================

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import {
  Bike,
  ChartLine,
  ChevronRight,
  CreditCard,
  Crown,
  HelpCircle,
  History,
  Settings,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { historyStore } from "@/lib/history";
import { PlanBadge, ProPromoCard } from "@/components/ProUI";

export type MenuScreen =
  | "historial"
  | "stats"
  | "premios"
  | "perfil"
  | "config"
  | "ayuda"
  | "pagos"
  | "amigos"
  | "planes";

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-semibold text-foreground hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        {label}
        {hint && <span className="block text-[11px] font-medium text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

export function AppDrawer({
  open,
  onClose,
  pro,
  username,
  email,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  pro: boolean;
  username?: string;
  email?: string;
  onNavigate: (s: MenuScreen) => void;
}) {
  const rides = useSyncExternalStore(historyStore.subscribe, historyStore.get, historyStore.getServer);

  // Cierra con Escape (accesibilidad básica)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const go = (s: MenuScreen) => {
    onClose();
    onNavigate(s);
  };

  const initial = (username || email || "C").trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Fondo */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="Menú principal"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[61] flex w-[84%] max-w-[340px] flex-col overflow-y-auto border-r border-border bg-sidebar pb-6 pt-[max(14px,env(safe-area-inset-top))] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Identidad */}
        <div className="flex items-center gap-3 px-4 pb-4 pt-1">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-800 text-[16px] font-extrabold text-emerald-50">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-foreground">{username || "Ciclista"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{email || "sin cuenta · modo local"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar menú" className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Zona 1: CUMBRE30 PRO */}
        <div className="px-3">
          {pro ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-extrabold tracking-wide text-emerald-600 dark:text-emerald-300">
                <Crown className="h-3.5 w-3.5" /> CUMBRE30 PRO ACTIVO
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Gracias por apoyar el proyecto. Todos los beneficios desbloqueados en este teléfono.
              </p>
            </div>
          ) : (
            <ProPromoCard onDiscover={() => go("planes")} />
          )}
        </div>

        {/* Zona 2: Mi actividad */}
        <div className="mt-4 px-3">
          <p className="px-1 pb-1 pt-2 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Mi actividad</p>
          <MenuItem icon={<History className="h-5 w-5" />} label="Mis viajes" onClick={() => go("historial")} />
          <MenuItem icon={<ChartLine className="h-5 w-5" />} label="Estadísticas generales" onClick={() => go("stats")} />
          <MenuItem icon={<Trophy className="h-5 w-5" />} label="Premios y desafíos" onClick={() => go("premios")} />
        </div>

        {/* Zona 3: Cuenta — perfil, amigos, pagos, config y ayuda consolidados */}
        <div className="mt-3 px-3">
          <p className="px-1 pb-1 pt-2 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Cuenta</p>
          <MenuItem icon={<UserRound className="h-5 w-5" />} label="Perfil" onClick={() => go("perfil")} />
          <MenuItem
            icon={<Users className="h-5 w-5" />}
            label="Amigos"
            hint="Km y logros de tu grupo"
            onClick={() => go("amigos")}
          />
          <MenuItem
            icon={<CreditCard className="h-5 w-5" />}
            label="Pagos y suscripciones"
            hint={pro ? "Pro activo · gestionar licencia" : "Modo Pro y aporte voluntario"}
            onClick={() => go("pagos")}
          />
          <MenuItem icon={<Settings className="h-5 w-5" />} label="Configuración" hint="Demo / GPS, sonido y voz" onClick={() => go("config")} />
          <MenuItem icon={<HelpCircle className="h-5 w-5" />} label="Ayuda y contacto" onClick={() => go("ayuda")} />
        </div>

        {/* Zona 4: Plan actual */}
        <div className="mt-3 px-3">
          <p className="px-1 pb-1 pt-2 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Plan actual</p>
          <button
            onClick={() => go("planes")}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-left hover:border-emerald-500/60"
          >
            <PlanBadge pro={pro} />
            <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">
              {pro ? "Pago único activo · ver beneficios" : "Funciones básicas · toca para ver planes"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          </button>
        </div>

        <div className="mt-auto px-4 pt-6 text-center text-[10.5px] leading-relaxed text-muted-foreground/60">
          Cumbre30 · ciclocomputador del cerro
          <br />
          {rides.length} {rides.length === 1 ? "viaje registrado" : "viajes registrados"}
        </div>
      </aside>
    </>
  );
}

/** Export auxiliar para el icono de bici en el header (consistencia). */
export { Bike };
