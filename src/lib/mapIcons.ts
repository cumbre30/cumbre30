// ============================================================
// Iconos Leaflet compartidos: pin de usuario (flecha por
// defecto o pin elegido), incidencias, destino y pasos.
// ============================================================

import L from "leaflet";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";
import { INCIDENT_BY_ID } from "@/lib/incidents";

/**
 * Pin del usuario: flecha orientada al rumbo (pin clásico) o burbuja del pin elegido.
 * `mapBearing` = rotación actual del mapa (grados, 0 = norte arriba): la burbuja del
 * pin elegido se contra-rota para verse SIEMPRE derecha en pantalla; la flecha clásica
 * ya rota con el rumbo, así que en modo navegación (mapa girado al rumbo) apunta
 * exactamente hacia arriba, como en Waze/Google Maps.
 */
export function userPinIcon(pinId: string | undefined, heading: number | null = null, mapBearing = 0): L.DivIcon {
  const p = PINS[(pinId ?? DEFAULT_PIN) as PinId] ?? PINS[DEFAULT_PIN];
  if (p.id === DEFAULT_PIN) {
    const deg = Math.round(heading ?? 0);
    return L.divIcon({
      className: "",
      html: `<div style="width:34px;height:34px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.65));">
  <svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${deg}deg);transition:transform .4s ease;">
    <circle cx="17" cy="17" r="12.5" fill="${p.color}" stroke="#fafafa" stroke-width="3"/>
    <path d="M17 9 L21.5 19.5 L17 17.2 L12.5 19.5 Z" fill="#09090b"/>
  </svg>
</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18],
    });
  }
  const upright = Math.round(-mapBearing);
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:38px;transform:rotate(${upright}deg);">
  <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px 9999px 9999px 4px;background:${p.color};border:3px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:16px;line-height:1;">${p.emoji}</div>
</div>`,
    iconSize: [34, 38],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

/** Marcador de incidencia (tamaño normal, mapa grande). */
export function incidentIcon(type: string): L.DivIcon {
  const t = INCIDENT_BY_ID[type] ?? INCIDENT_BY_ID.otro;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${t.color};border:2.5px solid #09090b;box-shadow:0 0 0 2px ${t.color}66;font-size:14px;line-height:1;">${t.emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

/** Marcador de incidencia compacto para el minimapa. */
export function miniIncidentIcon(type: string): L.DivIcon {
  const t = INCIDENT_BY_ID[type] ?? INCIDENT_BY_ID.otro;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:${t.color};border:2px solid #09090b;box-shadow:0 0 0 1.5px ${t.color}55;font-size:10px;line-height:1;">${t.emoji}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/** Bandera de destino. */
export function flagIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#0ea5e9;border:2.5px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:13px;line-height:1;">🏁</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Punto del próximo paso de navegación. */
export function stepDotIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:#ffffff;border:3px solid #0ea5e9;box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}
