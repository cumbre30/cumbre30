"use client";

// ============================================================
// Imagen 1080×1350 (4:5, ideal para post o historia de Instagram)
// con el resumen para compartir. Reutilizable desde Perfil
// ("Compartir perfil") y desde Mis viajes ("resumen semanal").
// Entrega por navigator.share (web) o panel nativo Android (APK).
// ============================================================

import { Capacitor } from "@capacitor/core";
import { shareOrDownloadFile } from "@/lib/shareFile";

export type ShareRow = { label: string; value: string };

export async function buildShareImage(opts: {
  /** Titular grande: pin + usuario, o "Mi semana en el cerro". */
  headline: string;
  /** Subtítulo bajo la marca (contexto del resumen). */
  sub: string;
  /** 4 filas etiqueta/valor. */
  rows: ShareRow[];
  /** Frase final; por defecto el mensaje del límite 30 km/h. */
  footer?: string;
}): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, "#09090b");
  g.addColorStop(0.6, "#052e1b");
  g.addColorStop(1, "#09090b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1350);

  // Perfil decorativo del cerro
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(60, 1050);
  ctx.lineTo(220, 900);
  ctx.lineTo(380, 960);
  ctx.lineTo(540, 760);
  ctx.lineTo(720, 840);
  ctx.lineTo(900, 640);
  ctx.lineTo(1020, 700);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 110px system-ui, sans-serif";
  ctx.fillText("Cumbre", 60, 190);
  ctx.fillStyle = "#34d399";
  ctx.fillText("30", 60 + ctx.measureText("Cumbre").width + 18, 190);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 40px system-ui, sans-serif";
  ctx.fillText("Ciclocomputador · Cerro San Cristóbal", 60, 260);

  // Titular
  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.fillText(opts.headline.slice(0, 28), 60, 420);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 40px system-ui, sans-serif";
  ctx.fillText(opts.sub.slice(0, 46), 60, 484);

  // Filas de estadísticas
  let y = 620;
  for (const row of opts.rows) {
    ctx.fillStyle = "#71717a";
    ctx.font = "500 36px system-ui, sans-serif";
    ctx.fillText(row.label.toUpperCase(), 60, y);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 76px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(row.value, 1020, y + 14);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, y + 44);
    ctx.lineTo(1020, y + 44);
    ctx.stroke();
    y += 120;
  }

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillText(opts.footer ?? "Respeta el límite: 30 km/h en el parque 🚴", 60, 1220);
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.fillText("¡Súmate y pedalea con Cumbre30!", 60, 1285);

  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png", 0.92)
  );
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
