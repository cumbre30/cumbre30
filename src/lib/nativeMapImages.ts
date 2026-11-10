// ============================================================
// Imágenes del mapa nativo: las mismas que dibuja el minimapa
// web, generadas con <canvas> y enviadas al plugin en base64
// (el lado nativo las decodifica y las registra como iconos).
// ============================================================

import { PINS, type PinId } from "@/lib/pins";
import { INCIDENT_TYPES } from "@/lib/incidents";

type Ctx = CanvasRenderingContext2D;

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toB64(c: HTMLCanvasElement): string {
  return c.toDataURL("image/png");
}

/** Chevron blanco (borde oscuro) que va sobre la ruta - 48×48 @3x. */
export function chevronB64(): string {
  const S = 144; // 48 * 3
  const { c, ctx } = makeCanvas(S);
  const k = S / 48;
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(4,7,11,0.95)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(11, 32);
  ctx.lineTo(24, 15);
  ctx.lineTo(37, 32);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(14, 31);
  ctx.lineTo(24, 19);
  ctx.lineTo(34, 31);
  ctx.stroke();
  return toB64(c);
}

/** Pin flecha clásico (círculo del color del pin + triángulo oscuro). */
export function puckArrowB64(color: string): string {
  const S = 96; // 38px @2.5x
  const { c, ctx } = makeCanvas(S);
  const cx = S / 2;
  const cy = S / 2;
  const r = S * 0.36;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = S * 0.085;
  ctx.strokeStyle = "#fafafa";
  ctx.stroke();
  // triángulo apuntando arriba (norte en espacio de mapa)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.62);
  ctx.lineTo(cx + r * 0.36, cy + r * 0.18);
  ctx.lineTo(cx, cy - r * 0.02);
  ctx.lineTo(cx - r * 0.36, cy + r * 0.18);
  ctx.closePath();
  ctx.fillStyle = "#09090b";
  ctx.fill();
  return toB64(c);
}

/** Burbuja de pin estilo mapa (esquina inferior izquierda afilada) + emoji. */
export function pinBubbleB64(emoji: string, color: string): string {
  const S = 96;
  const { c, ctx } = makeCanvas(S);
  const inset = 6;
  const w = S - inset * 2;
  const radii = [w / 2, w / 2, w / 2, w * 0.12]; // TL TR BR BL
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(inset, inset, w, w, radii);
  } else {
    ctx.arc(S / 2, S / 2, w / 2, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#fafafa";
  ctx.stroke();
  ctx.font = "48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, S / 2, S / 2 + 3);
  return toB64(c);
}

/** Bandera de destino (círculo celeste + 🏁). */
export function flagB64(): string {
  const S = 84;
  const { c, ctx } = makeCanvas(S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#0ea5e9";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#fafafa";
  ctx.stroke();
  ctx.font = "40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏁", S / 2, S / 2 + 2);
  return toB64(c);
}

/** Marcador de incidencia (disco del color del tipo + emoji). */
export function incidentB64(emoji: string, color: string): string {
  const S = 72;
  const { c, ctx } = makeCanvas(S);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#09090b";
  ctx.stroke();
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, S / 2, S / 2 + 2);
  return toB64(c);
}

let cache: Record<string, string> | null = null;

/** Toda la batería de iconos (se registran una vez por mapa). */
export function nativeMapImages(): Record<string, string> {
  if (cache) return cache;
  const out: Record<string, string> = {
    "c30-chev": chevronB64(),
    "c30-flag": flagB64(),
  };
  for (const p of Object.values(PINS)) {
    if (p.id === "clasico") {
      out["c30-puck"] = puckArrowB64(p.color);
    } else {
      out[`c30-pin-${p.id}`] = pinBubbleB64(p.emoji, p.color);
    }
  }
  for (const t of INCIDENT_TYPES) {
    out[`c30-inc-${t.id}`] = incidentB64(t.emoji, t.color);
  }
  cache = out;
  return out;
}

export function puckIconFor(pinId: string | undefined): { icon: string; kind: "arrow" | "pin" } {
  const p = PINS[(pinId ?? "clasico") as PinId] ?? PINS.clasico;
  return p.id === "clasico" ? { icon: "c30-puck", kind: "arrow" } : { icon: `c30-pin-${p.id}`, kind: "pin" };
}
