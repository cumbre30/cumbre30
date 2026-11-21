"use client";

// ============================================================
// Tarjetas para compartir — Propuesta B «ADN helicoidal»
// (mockup aprobado 2026-11-21, download/mockups-compartir-cumbre30.html)
//
//   · buildAdnImage: ficha de laboratorio del ciclista — doble
//     hélice con las 6 travesañas de los ejes (grosor = puntaje,
//     color = eje), arquetipo como título de espécimen.
//   · buildWeekImage: ficha semanal — tira cronológica de 7 días
//     (altura = km), anillo de días activos. SIN conteo de
//     constancias emitidas: la cabecera lleva solo el rango.
//
// Ambas: 1080×1350 (4:5, Instagram/historias), paleta real de la
// app (zinc-950, esmeralda, los 6 colores de COLOR_EJE) y TODOS
// los rótulos vía t() — el idioma de las estadísticas sigue el
// idioma seteado por el usuario (es/en/pt), nada queda fijado en
// el dibujo. La entrega es sharePngBlob (navigator.share web /
// panel nativo Android), igual que antes.
// ============================================================

import { Capacitor } from "@capacitor/core";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { t, getLang, type Lang } from "@/lib/i18n";

// ---------- helpers puros (probados en node) ----------

/** Colores de los 6 ejes — mismos hex que COLOR_EJE en PerfilTab
 *  (el canvas no lee variables CSS). */
export const EJE_HEX: Record<string, string> = {
  climbing: "#10b981",
  endurance: "#38bdf8",
  speed: "#f59e0b",
  power: "#a78bfa",
  consistency: "#fb7185",
  explorer: "#2dd4bf",
};

/** Orden fijo de los 6 ejes (claves de p.scores). */
export const CLAVES_EJE = ["climbing", "endurance", "speed", "power", "consistency", "explorer"] as const;

/** Rótulo de cada eje (claves i18n pc.e*, compartidas con el radar). */
export const EJE_I18N: Record<string, string> = {
  climbing: "pc.eClimbing",
  endurance: "pc.eEndurance",
  speed: "pc.eSpeed",
  power: "pc.ePower",
  consistency: "pc.eConsistency",
  explorer: "pc.eExplorer",
};

/** Número de semana ISO (lunes = día 1). Para «FICHA · SEM 47». */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const anioInicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - anioInicio.getTime()) / 86400000 + 1) / 7);
}

export type WeekRideLite = { dateISO: string; distanceKm: number };

/** Km por día de la semana (índice 0 = lunes … 6 = domingo). */
export function weekDaysKm(rides: WeekRideLite[], start: Date, end: Date): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rides) {
    const d = new Date(r.dateISO);
    if (d < start || d >= end) continue; // fuera de la semana: no suma
    const idx = (d.getDay() + 6) % 7;
    out[idx] += r.distanceKm;
  }
  return out;
}

/** Alturas de barra (escala sobre el máximo de la semana, piso 14 px),
 *  índice del día con más km (-1 si no hubo) y días activos. */
export function barHeights(km: number[]): { heights: number[]; maxIdx: number; activeDays: number } {
  const maxk = Math.max(...km, 0);
  const heights = km.map((k) => (maxk > 0 && k > 0 ? Math.max(14, (k / maxk) * 260) : 14));
  let maxIdx = -1;
  let maxV = 0;
  km.forEach((k, i) => {
    if (k > maxV) {
      maxV = k;
      maxIdx = i;
    }
  });
  return { heights, maxIdx, activeDays: km.filter((k) => k > 0).length };
}

/** Grosor de la travesaña: 4 px base + hasta 16 px por puntaje. */
export function rungWidth(score: number | null): number {
  return 4 + ((score ?? 0) / 100) * 16;
}

/** Decimal con coma para es/pt, punto para en (formato de la tarjeta). */
export function fmt1(v: number, lang?: Lang): string {
  const s = v.toFixed(1);
  return (lang ?? getLang()) === "en" ? s : s.replace(".", ",");
}

/** Entero con separador de miles: espacio fino es/pt, coma en. */
export function fmtInt(v: number, lang?: Lang): string {
  const s = Math.round(v).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, (lang ?? getLang()) === "en" ? "," : " ");
}

export type AdnExtras = {
  vamAvg: number | null;
  estWatts: number | null;
  flatAvg: number | null;
  co2Kg: number | null;
};

/** Fila de KPIs de la ficha ADN (rótulo i18n + valor formateado).
 *  Todo sale del idioma GLOBAL de la app — que es el idioma seteado
 *  por el usuario (t() y getLang() leen la misma fuente). */
export function kpiTexts(ex: AdnExtras): Array<[string, string]> {
  return [
    ["VAM", ex.vamAvg === null ? "—" : `${Math.round(ex.vamAvg)} m/h`],
    [t("sc.kWatts"), ex.estWatts === null ? "—" : `${ex.estWatts} W`],
    [t("sc.kLlano"), ex.flatAvg === null ? "—" : `${fmt1(ex.flatAvg)} km/h`],
    ["CO₂", ex.co2Kg === null ? "—" : `−${fmt1(ex.co2Kg)} kg`],
  ];
}

/** Rango de la semana en el idioma activo («10–16 NOV»). */
export function weekRangeLabel(start: Date, end: Date, lang?: Lang): string {
  const l = lang ?? getLang();
  const locale = l === "en" ? "en-GB" : l === "pt" ? "pt-BR" : "es-CL";
  const f = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" }).toUpperCase();
  return `${f(start)} – ${f(end)}`;
}

/** Tiempo héroe de la tarjeta semanal: h:mm (bajo 1 h → mm min). */
export function fmtHoras(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `${m} min`;
}

// ---------- primitivas de dibujo (canvas 2d) ----------

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function texto(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, opts: {
  size: number; color: string; weight?: string; ls?: number; align?: CanvasTextAlign;
}): void {
  ctx.font = `${opts.weight ?? "700"} ${opts.size}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  if (opts.ls !== undefined) {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.ls}px`;
    } catch {
      // navegador sin letterSpacing: el texto sale más junto, sin error
    }
  }
  ctx.fillText(s, x, y);
  if (opts.ls !== undefined) {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    } catch {
      // idem
    }
  }
  ctx.textAlign = "left";
}

function fondo(ctx: CanvasRenderingContext2D, altoFin: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, "#0a0a0c");
  g.addColorStop(1, altoFin);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1350);
}

/** Retícula técnica (Propuesta B). */
function reticula(ctx: CanvasRenderingContext2D, yDesde: number, yHasta: number): void {
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 1.5;
  for (let x = 60; x <= 1020; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, yDesde);
    ctx.lineTo(x, yHasta);
    ctx.stroke();
  }
  for (let y = yDesde + 60; y <= yHasta; y += 110) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(1020, y);
    ctx.stroke();
  }
}

/** Marca: «Cumbre» blanco + «30» esmeralda. */
function marca(ctx: CanvasRenderingContext2D, colorTreinta: string): void {
  texto(ctx, "Cumbre", 60, 150, { size: 56, color: "#fafafa", weight: "800", ls: -1 });
  ctx.font = "800 56px system-ui, -apple-system, sans-serif";
  const w = ctx.measureText("Cumbre").width;
  texto(ctx, "30", 60 + w + 2, 150, { size: 56, color: colorTreinta, weight: "800", ls: -1 });
}

function lineaFirma(ctx: CanvasRenderingContext2D, y: number, colorLema: string): void {
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(1020, y);
  ctx.stroke();
  texto(ctx, t("sc.lema"), 60, y + 65, { size: 38, color: "#fafafa", weight: "800", ls: 6 });
  texto(ctx, "cumbre30.app", 1020, y + 65, { size: 25, color: colorLema, weight: "700", ls: 2, align: "right" });
}

// ---------- tarjeta ADN (ficha de laboratorio) ----------

export type AdnShareInput = {
  /** Clave del arquetipo (p.archetype): CLIMBER, CALIBRATING… */
  archetype: string;
  calibrating: boolean;
  validRides: number;
  minRides: number;
  scores: Record<string, number | null>;
  extras: AdnExtras;
};

const RUNG_T = [0.14, 0.4, 0.52, 0.66, 0.82, 0.93]; // posición de cada eje en la hélice

export async function buildAdnImage(input: AdnShareInput): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext("2d")!;

  fondo(ctx, "#0d0f14");
  reticula(ctx, 300, 1130);
  marca(ctx, "#34d399");

  // cabecera de espécimen
  const calibrando = input.calibrating;
  texto(ctx, t("sc.adnEtiqueta"), 1020, 150, {
    size: calibrando ? 26 : 30, color: "#a78bfa", weight: "700", ls: 4, align: "right",
  });
  const emoji = ARCH_EMOJI[input.archetype] ?? "";
  texto(ctx, `${t(`pc.arch${input.archetype}`)} ${emoji}`.trim(), 60, 215, { size: 66, color: "#fafafa", weight: "800", ls: 3 });
  texto(
    ctx,
    calibrando ? t("sc.adnCalibrando", input.validRides, input.minRides) : t("sc.adnPerfil"),
    60, 270, { size: 24, color: "#71717a", weight: "600", ls: 4 },
  );

  // leyenda de las dos hebras
  const hiloY = 325;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(660, hiloY);
  ctx.lineTo(700, hiloY);
  ctx.stroke();
  texto(ctx, t("sc.hiloEnd"), 712, hiloY + 8, { size: 20, color: "#71717a", weight: "700", ls: 2 });
  ctx.strokeStyle = "#10b981";
  ctx.beginPath();
  ctx.moveTo(880, hiloY);
  ctx.lineTo(920, hiloY);
  ctx.stroke();
  texto(ctx, t("sc.hiloEsc"), 932, hiloY + 8, { size: 20, color: "#71717a", weight: "700", ls: 2 });

  // hélice: dos senos enfrentados (fase π) + travesañas por eje
  const x0 = 210, x1 = 870, A = 150, yc = 760, N = 220;
  const alpha = calibrando ? 0.35 : 1;
  ctx.globalAlpha = alpha;
  for (const [fase, color] of [[1, "#38bdf8"], [-1, "#10b981"]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const tt = i / N;
      const x = x0 + (x1 - x0) * tt;
      const y = yc + fase * Math.sin(tt * Math.PI * 3) * A;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  CLAVES_EJE.forEach((k, i) => {
    const tt = RUNG_T[i];
    const x = x0 + (x1 - x0) * tt;
    const y1 = yc + Math.sin(tt * Math.PI * 3) * A;
    const y2 = yc - Math.sin(tt * Math.PI * 3) * A;
    const w = rungWidth(input.scores[k] ?? null);
    ctx.strokeStyle = EJE_HEX[k];
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    for (const y of [y1, y2]) {
      ctx.fillStyle = EJE_HEX[k];
      ctx.beginPath();
      ctx.arc(x, y, w * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0a0a0c";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;

  // leyenda de los 6 ejes bajo la hélice (valor + nombre en su color)
  CLAVES_EJE.forEach((k, i) => {
    const v = input.scores[k] ?? null;
    const x = 60 + i * 165;
    texto(ctx, v === null ? "—" : String(Math.round(v)), x, 1030, { size: 34, color: "#fafafa", weight: "800" });
    texto(ctx, t(EJE_I18N[k]).toUpperCase(), x, 1062, { size: 15, color: EJE_HEX[k], weight: "700", ls: 1.5 });
  });

  // bloque inferior de KPIs en mono
  kpiTexts(input.extras).forEach(([l, v], i) => {
    const x = 60 + i * 240;
    texto(ctx, l, x, 1200, { size: 20, color: "#71717a", weight: "700", ls: 3 });
    texto(ctx, v, x, 1246, { size: 40, color: "#fafafa", weight: "800" });
  });

  lineaFirma(ctx, 1280, "#a78bfa");
  return aPng(c);
}

/** Emoji por arquetipo (mismo mapa que PerfilTab). */
export const ARCH_EMOJI: Record<string, string> = {
  CALIBRATING: "🧭",
  CLIMBER: "⛰️",
  ENDURANCE: "🚴",
  TIME_TRIALIST: "⏱️",
  SPRINTER: "⚡",
  EXPLORER: "🗺️",
  ALL_ROUNDER: "🎯",
  URBAN: "🏙️",
};

// ---------- tarjeta semanal (tira de 7 días) ----------

export type WeekShareInput = {
  /** Solo viajes GPS reales en bici (los demo y motorizados no). */
  rides: WeekRideLite[];
  start: Date; // lunes 00:00
  end: Date;   // lunes siguiente 00:00
};

export async function buildWeekImage(input: WeekShareInput): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext("2d")!;

  fondo(ctx, "#0a0a0c");
  reticula(ctx, 240, 1180);
  marca(ctx, "#34d399");

  const diasKm = weekDaysKm(input.rides, input.start, input.end);
  const { heights, maxIdx, activeDays } = barHeights(diasKm);
  const kmTotal = diasKm.reduce((a, b) => a + b, 0);
  const secTotal = (input.rides as Array<WeekRideLite & { elapsedSec?: number }>).reduce((a, r) => a + (r.elapsedSec ?? 0), 0);
  const gainTotal = (input.rides as Array<WeekRideLite & { gainM?: number }>).reduce((a, r) => a + (r.gainM ?? 0), 0);

  texto(ctx, t("sc.fichaN", isoWeekNumber(input.start)), 1020, 150, { size: 30, color: "#71717a", weight: "700", ls: 4, align: "right" });
  texto(ctx, weekRangeLabel(input.start, new Date(input.end.getTime() - 1)), 60, 205, { size: 26, color: "#a1a1aa", weight: "500", ls: 3 });

  // héroe: km · tiempo · desnivel — SIN conteo de viajes/constancias
  let x = 60;
  texto(ctx, fmt1(kmTotal), x, 330, { size: 104, color: "#fafafa", weight: "800", ls: -2 });
  ctx.font = "800 104px system-ui, -apple-system, sans-serif";
  x += ctx.measureText(fmt1(kmTotal)).width + 18;
  texto(ctx, "km", x, 330, { size: 44, color: "#34d399", weight: "800", ls: 2 });
  ctx.font = "800 44px system-ui, -apple-system, sans-serif";
  x += ctx.measureText("km").width + 38;
  texto(ctx, "·", x, 330, { size: 44, color: "#3f3f46", weight: "400" });
  x += 44;
  texto(ctx, fmtHoras(secTotal), x, 330, { size: 60, color: "#fafafa", weight: "800" });
  ctx.font = "800 60px system-ui, -apple-system, sans-serif";
  x += ctx.measureText(fmtHoras(secTotal)).width + 12;
  texto(ctx, "h", x, 330, { size: 32, color: "#71717a", weight: "600" });
  if (gainTotal > 0) {
    ctx.font = "800 32px system-ui, -apple-system, sans-serif";
    x += ctx.measureText("h").width + 34;
    texto(ctx, `+${fmtInt(gainTotal)}`, x, 330, { size: 60, color: "#fafafa", weight: "800" });
    ctx.font = "800 60px system-ui, -apple-system, sans-serif";
    x += ctx.measureText(`+${fmtInt(gainTotal)}`).width + 8;
    texto(ctx, t("sc.unidadD"), x, 330, { size: 32, color: "#71717a", weight: "600" });
  }

  // tira de 7 días: altura = km del día sobre el máximo de la semana
  const dias = t("sc.dias").split(" ");
  const bw = 92, gap = 37, x0 = 60, base = 1130;
  diasKm.forEach((k, i) => {
    const bx = x0 + i * (bw + gap);
    const h = heights[i];
    const grad = ctx.createLinearGradient(0, base - h, 0, base);
    grad.addColorStop(0, "#34d399");
    grad.addColorStop(1, "rgba(52,211,153,.12)");
    ctx.fillStyle = grad;
    rectRedondeado(ctx, bx, base - h, bw, h, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(52,211,153,.5)";
    ctx.lineWidth = 2;
    rectRedondeado(ctx, bx, base - h, bw, h, 14);
    ctx.stroke();
    texto(ctx, k > 0 ? fmt1(k) : "—", bx + bw / 2, base - h - 18, {
      size: 28, color: k > 0 ? "#fafafa" : "#3f3f46", weight: "800", align: "center",
    });
    texto(ctx, dias[i], bx + bw / 2, base + 52, {
      size: 30, color: i === maxIdx ? "#34d399" : "#71717a", weight: "800", ls: 2, align: "center",
    });
    if (i === maxIdx) {
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2.5;
      rectRedondeado(ctx, bx - 10, base - h - 110, bw + 20, 44, 22);
      ctx.stroke();
      texto(ctx, t("sc.tope"), bx + bw / 2, base - h - 80, { size: 24, color: "#34d399", weight: "800", ls: 3, align: "center" });
    }
  });

  // anillo de días activos (hábito, no constancias)
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(930, 870, 86, 0, Math.PI * 2);
  ctx.stroke();
  if (activeDays > 0) {
    ctx.strokeStyle = "#34d399";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(930, 870, 86, -Math.PI / 2, -Math.PI / 2 + (activeDays / 7) * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  texto(ctx, `${activeDays}/7`, 930, 860, { size: 44, color: "#fafafa", weight: "800", align: "center" });
  texto(ctx, t("sc.diasActivos"), 930, 905, { size: 22, color: "#71717a", weight: "600", ls: 1, align: "center" });

  lineaFirma(ctx, 1240, "#34d399");
  return aPng(c);
}

// ---------- entrega (igual que antes) ----------

function aPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png", 0.92));
}

/**
 * Comparte un PNG por el panel del sistema (Instagram, WhatsApp…) o
 * lo descarga como respaldo. Devuelve el mensaje para la UI.
 */
export async function sharePngBlob(
  blob: Blob,
  fileName: string,
  text: string
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "image/png" });
  let native = false;
  try {
    native = Capacitor.isNativePlatform();
  } catch {
    native = false;
  }
  const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!native && nav2.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Cumbre30", text });
    return "shared";
  }
  // APK: el WebView no soporta <a download> ni navigator.share →
  // el archivo se entrega por el panel nativo de Android.
  const res = await shareOrDownloadFile({ blob, fileName, title: "Cumbre30", text });
  return res === "shared" ? "shared" : "downloaded";
}
