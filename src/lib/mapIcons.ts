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
 * Todo va dentro de un wrapper `c30-billboard`: en el minimapa 3D (clase c30-tilt)
 * ese wrapper contra-rota la inclinación de la cámara para que el pin se vea de pie.
 */
export function userPinIcon(pinId: string | undefined, heading: number | null = null, mapBearing = 0): L.DivIcon {
  const p = PINS[(pinId ?? DEFAULT_PIN) as PinId] ?? PINS[DEFAULT_PIN];
  if (p.id === DEFAULT_PIN) {
    const deg = Math.round(heading ?? 0);
    return L.divIcon({
      className: "",
      html: `<div class="c30-billboard"><div style="width:34px;height:34px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.65));">
  <svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${deg}deg);transition:transform .4s ease;">
    <circle cx="17" cy="17" r="12.5" fill="${p.color}" stroke="#fafafa" stroke-width="3"/>
    <path d="M17 9 L21.5 19.5 L17 17.2 L12.5 19.5 Z" fill="#09090b"/>
  </svg>
</div></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18],
    });
  }
  const upright = Math.round(mapBearing); // mapa rotado -b° en pantalla: la burbuja se rota +b° para verse derecha
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="width:34px;height:38px;transform:rotate(${upright}deg);">
  <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px 9999px 9999px 4px;background:${p.color};border:3px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:16px;line-height:1;">${p.emoji}</div>
</div></div>`,
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
    html: `<div class="c30-billboard"><div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${t.color};border:2.5px solid #09090b;box-shadow:0 0 0 2px ${t.color}66;font-size:14px;line-height:1;">${t.emoji}</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

/** Marcador genérico de capa (POI, normativa, conexión urbana): burbuja de emoji con color de la capa. */
export function poiIcon(emoji: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};border:2.5px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.55);font-size:13px;line-height:1;">${emoji}</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

/** Marcador de incidencia compacto para el minimapa. */
export function miniIncidentIcon(type: string): L.DivIcon {
  const t = INCIDENT_BY_ID[type] ?? INCIDENT_BY_ID.otro;
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:${t.color};border:2px solid #09090b;box-shadow:0 0 0 1.5px ${t.color}55;font-size:10px;line-height:1;">${t.emoji}</div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/** Bandera de destino. */
export function flagIcon(mapBearing = 0): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;transform:rotate(${Math.round(mapBearing)}deg);border-radius:9999px;background:#0ea5e9;border:2.5px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:13px;line-height:1;">🏁</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Marcador personal guardado por el ciclista (Pro). */
export function markIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px 9999px 9999px 4px;background:#10b981;border:2.5px solid #fafafa;box-shadow:0 2px 8px rgba(0,0,0,.6);font-size:13px;line-height:1;">📍</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    popupAnchor: [0, -24],
  });
}

/** Insignia blanca del próximo giro (estilo Waze) sobre la ruta. */
export function stepBadgeIcon(icon: "start" | "left" | "right" | "uturn" | "straight" | "end"): L.DivIcon {
  const stroke = `stroke="#09090b" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  let inner: string;
  if (icon === "left") {
    inner = `<path d="M64 84 L64 58 Q64 38 44 38 L30 38" ${stroke}/><path d="M40 18 L12 38 L40 58 Z" fill="#09090b"/>`;
  } else if (icon === "right") {
    inner = `<path d="M32 84 L32 58 Q32 38 52 38 L66 38" ${stroke}/><path d="M56 18 L84 38 L56 58 Z" fill="#09090b"/>`;
  } else if (icon === "uturn") {
    inner = `<path d="M30 84 L30 44 Q30 20 52 20 Q74 20 74 44 L74 58" ${stroke}/><path d="M56 52 L74 80 L92 52 Z" fill="#09090b"/>`;
  } else if (icon === "end") {
    inner = `<path d="M44 86 L44 20" ${stroke}/><path d="M44 16 L82 16 L82 46 L44 46 Z" fill="#09090b"/>`;
  } else {
    inner = `<path d="M48 84 L48 40" ${stroke}/><path d="M48 12 L70 44 L26 44 Z" fill="#09090b"/>`;
  }
  return L.divIcon({
    className: "",
    html: `<div class="c30-billboard"><div style="width:30px;height:30px;border-radius:8px;background:#fafafa;border:2px solid #09090b;box-shadow:0 2px 8px rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;">
  <svg width="22" height="22" viewBox="0 0 96 96">${inner}</svg>
</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}
