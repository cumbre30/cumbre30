"use client";

// ============================================================
// Temas y personalización de la pantalla ride (Cumbre30 Pro).
//
// Qué controla:
//   · color       - paleta de la app completa: remapea la escala
//                   emerald por CSS (html[data-accent="..."]) sin
//                   tocar las clases de los componentes. El tema
//                   "cerro" (verde, original) no escribe atributo.
//   · speedoStyle - digital (número grande), arco (gauge 270°),
//                   dial (círculo con marcas) o aguja (analógico con
//                   zonas ámbar/rojo sobre 25 y 30 km/h).
//   · speedoSize  - normal / grande / gigante.
//   · minimapSize - compacto / normal / grande (altura del minimapa).
//   · minimapStyle - clásico / tarjeta / plano (marco estético).
//   · speedoStyle también agrega anillo (círculo 360°) y bloque
//     (tablero de segmentos) desde v1.12.13, sólo estética.
//
// Persistencia: localStorage (funciona offline en el APK). El
// snapshot del servidor son los valores por defecto, así que el
// primer render coincide con el HTML y no hay problemas de
// hidratación; el atributo data-accent se aplica con un efecto
// desde page.tsx cuando el color cambia.
//
// Gating Pro: en Configuración (ConfigTab) las opciones marcadas
// proOnly se ofrecen solo con licencia activa. Aquí solo se guarda.
// ============================================================

import { useSyncExternalStore } from "react";

export type ThemeColorId = "cerro" | "andes" | "atardecer" | "lila" | "grafito";
export type SpeedoStyle = "digital" | "arco" | "dial" | "aguja" | "anillo" | "bloque";
export type SpeedoSize = "normal" | "grande" | "gigante";
export type MinimapSize = "compacto" | "normal" | "grande";
// Estilo estético del minimapa (v1.12.13): el marco y el acabado,
// independiente del tamaño.
export type MinimapStyle = "clasico" | "tarjeta" | "plano";

export type RideThemeSettings = {
  color: ThemeColorId;
  speedoStyle: SpeedoStyle;
  speedoSize: SpeedoSize;
  minimapSize: MinimapSize;
  minimapStyle: MinimapStyle;
};

export const DEFAULT_RIDE_THEME: RideThemeSettings = {
  color: "cerro",
  speedoStyle: "digital",
  speedoSize: "normal",
  minimapSize: "normal",
  minimapStyle: "clasico",
};

/** Paletas: swatch = color del punto en el selector de Configuración. */
export const THEME_COLORS: { id: ThemeColorId; label: string; swatch: string; proOnly: boolean }[] = [
  { id: "cerro", label: "Cerro", swatch: "#059669", proOnly: false },
  { id: "andes", label: "Andes", swatch: "#0284c7", proOnly: true },
  { id: "atardecer", label: "Atardecer", swatch: "#d97706", proOnly: true },
  { id: "lila", label: "Lila", swatch: "#9333ea", proOnly: true },
  { id: "grafito", label: "Grafito", swatch: "#3f3f46", proOnly: true },
];

export const SPEEDO_STYLES: { id: SpeedoStyle; label: string; proOnly: boolean }[] = [
  { id: "digital", label: "Digital", proOnly: false },
  { id: "arco", label: "Arco", proOnly: true },
  { id: "dial", label: "Dial", proOnly: true },
  { id: "aguja", label: "Aguja", proOnly: true },
  // Nuevos diseños (cliente 2026-11-17, sólo estética):
  { id: "anillo", label: "Anillo", proOnly: true },
  { id: "bloque", label: "Bloque", proOnly: true },
];

export const SPEEDO_SIZES: { id: SpeedoSize; label: string; proOnly: boolean }[] = [
  { id: "normal", label: "Normal", proOnly: false },
  { id: "grande", label: "Grande", proOnly: true },
  { id: "gigante", label: "Gigante", proOnly: true },
];

export const MINIMAP_SIZES: { id: MinimapSize; label: string; proOnly: boolean }[] = [
  { id: "compacto", label: "Compacto", proOnly: false },
  { id: "normal", label: "Normal", proOnly: false },
  { id: "grande", label: "Grande", proOnly: true },
];

export const MINIMAP_STYLES: { id: MinimapStyle; label: string; proOnly: boolean }[] = [
  { id: "clasico", label: "Clásico", proOnly: false },
  { id: "tarjeta", label: "Tarjeta", proOnly: true },
  { id: "plano", label: "Plano", proOnly: true },
];

// --- alturas del minimapa por tamaño (clases Tailwind) ---
export function minimapHeight(size: MinimapSize): { base: string; route: string } {
  switch (size) {
    case "compacto":
      return { base: "h-40", route: "h-64" };
    case "grande":
      return { base: "h-64 sm:h-72", route: "h-[24rem]" };
    default:
      return { base: "h-52 sm:h-56", route: "h-80" };
  }
}

// --- clases del marco del minimapa por estilo ---
export function minimapStyleCls(style: MinimapStyle): string {
  switch (style) {
    case "tarjeta":
      return "rounded-3xl border-2 border-emerald-600/70 shadow-xl ring-1 ring-emerald-500/20";
    case "plano":
      return "rounded-xl border-0 shadow-none ring-1 ring-border";
    default:
      return "rounded-2xl border border-border shadow-lg";
  }
}

// --- tamaño del velocímetro por preset ---
export function speedoFontPx(size: SpeedoSize): number {
  switch (size) {
    case "grande":
      return 96;
    case "gigante":
      return 116;
    default:
      return 76;
  }
}

export function speedoGaugeWidth(size: SpeedoSize): number {
  switch (size) {
    case "grande":
      return 310;
    case "gigante":
      return 370;
    default:
      return 250;
  }
}

// --- store reactivo (mismo patrón que proLicense) ---
const STORE_KEY = "cumbre30-ridetheme-v1";

let snap: RideThemeSettings = DEFAULT_RIDE_THEME;
const listeners = new Set<() => void>();

function readStored(): RideThemeSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RideThemeSettings>;
    return {
      color: THEME_COLORS.some((c) => c.id === p.color) ? (p.color as ThemeColorId) : DEFAULT_RIDE_THEME.color,
      speedoStyle: SPEEDO_STYLES.some((s) => s.id === p.speedoStyle) ? (p.speedoStyle as SpeedoStyle) : DEFAULT_RIDE_THEME.speedoStyle,
      speedoSize: SPEEDO_SIZES.some((s) => s.id === p.speedoSize) ? (p.speedoSize as SpeedoSize) : DEFAULT_RIDE_THEME.speedoSize,
      minimapSize: MINIMAP_SIZES.some((m) => m.id === p.minimapSize) ? (p.minimapSize as MinimapSize) : DEFAULT_RIDE_THEME.minimapSize,
      minimapStyle: MINIMAP_STYLES.some((m) => m.id === p.minimapStyle) ? (p.minimapStyle as MinimapStyle) : DEFAULT_RIDE_THEME.minimapStyle,
    };
  } catch {
    return null;
  }
}

function notify(): void {
  for (const l of listeners) l();
}

function recompute(): void {
  snap = readStored() ?? DEFAULT_RIDE_THEME;
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  // Primera suscripción: sincroniza desde localStorage (cliente).
  recompute();
  return () => {
    listeners.delete(l);
  };
}

/** Guarda cambios y avisa a los componentes suscritos. */
export function saveRideTheme(patch: Partial<RideThemeSettings>): void {
  if (typeof window === "undefined") return;
  const next = { ...snap, ...patch };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // almacenamiento lleno o bloqueado: igual se aplica en memoria
  }
  snap = next;
  notify();
}

const getSnap = (): RideThemeSettings => snap;
const getServerSnap = (): RideThemeSettings => DEFAULT_RIDE_THEME;

export function useRideTheme(): RideThemeSettings {
  return useSyncExternalStore(subscribe, getSnap, getServerSnap);
}

/**
 * Aplica el tema de color en el <html> (atributo data-accent).
 * El tema "cerro" limpia el atributo: los estilos base ya son verdes.
 * Llamar desde un efecto en page.tsx cada vez que cambia el color.
 */
export function applyThemeColor(color: ThemeColorId): void {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  if (color === "cerro") html.removeAttribute("data-accent");
  else html.setAttribute("data-accent", color);
}
