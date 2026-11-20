// leaflet-rotate está empaquetado como IIFE que lee la GLOBAL `L`
// al evaluarse (no acepta imports ESM). Este módulo debe importarse
// ANTES de "leaflet-rotate" para que L exista como global a tiempo.
// v1.13.7: globalThis en vez de window - el prerender del export
// estático también evalúa este módulo (sin window) y el plugin se
// evalúa igual en el bundle de servidor.
import L from "leaflet";

const g = globalThis as unknown as { L?: unknown };
if (!g.L) g.L = L;

export {};
