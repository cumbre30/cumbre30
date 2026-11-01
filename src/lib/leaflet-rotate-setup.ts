// leaflet-rotate está empaquetado como IIFE que lee la GLOBAL `L`
// al evaluarse (no acepta imports ESM). Este módulo debe importarse
// ANTES de "leaflet-rotate" para que window.L exista a tiempo.
import L from "leaflet";

const w = window as unknown as { L?: unknown };
if (!w.L) w.L = L;

export {};
