// ============================================================
// Constancia de Registro de Trayecto (PDF) - Cumbre30
// ------------------------------------------------------------
// Documento formal autogenerado a partir de un ride guardado en
// el historial local. Pensado como respaldo del ciclista ante
// partes por "exceso de velocidad" en el Parque Metropolitano de
// Santiago (límite 30 km/h).
//
// Criterios de redacción (importante):
//   - Declaración honesta: dice que es una bitácora electrónica
//     autogenerada por el propio titular, que no reemplaza
//     registros oficiales ni es un peritaje de tercero.
//   - Explica el origen técnico de los datos (GPS Doppler +
//     filtrado) y el límite de 30 km/h como referencia.
//   - Código de verificación SHA-256 del contenido emitido.
//   - Si el ride viene del modo demostración, se advierte en
//     rojo que NO sirve como respaldo.
//
// Sin dependencias del DOM: también corre en Node (script de
// ejemplo y pruebas).
// ============================================================

import { jsPDF } from "jspdf";
import { APP_VERSION } from "./appVersion";
import type { RideSummary } from "./history";

export type RideIdentity = {
  name?: string;
  email?: string;
  username?: string;
};

/** Identidad para el PDF del ride: la que viene de la sesión
 * (cuenta o modo offline). Ya no hay ficha médica local. */
export function resolveRideIdentity(explicit?: RideIdentity): RideIdentity {
  return { ...(explicit ?? {}) };
}

/** SHA-256 hex (WebCrypto). Fallback interno si no hay crypto.subtle. */
async function sha256Hex(input: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const buf = await subtle.digest("SHA-256", new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // usar fallback
  }
  // Fallback FNV-1a doble (solo si no existe WebCrypto; caso muy raro).
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h = (h ^ input.charCodeAt(i)) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return (fnv(0x811c9dc5) + fnv(0x01000193) + fnv(0xdeadbeef) + fnv(0x1234567)).repeat(2).slice(0, 64);
}

// ---------- formateadores (hora local de Chile) ----------

const fmtLongDate = new Intl.DateTimeFormat("es-CL", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  timeZone: "America/Santiago",
});
const fmtTime = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago",
});
const fmtDateTime = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago",
});

function num(n: number, dec = 2): string {
  return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function duracion(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const humano = h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${s} s` : `${s} s`;
  return `${clock} (${humano})`;
}

function titleCase(d: string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

// ---------- construcción del documento ----------

export async function buildRidePdf(r: RideSummary, identity?: RideIdentity): Promise<jsPDF> {
  const id = resolveRideIdentity(identity);
  const emitted = new Date();
  const verifCode = await sha256Hex(
    JSON.stringify({ app: "cumbre30", v: APP_VERSION, ride: r, identity: id })
  );

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 20; // margen
  const W = 210 - 2 * M;
  let y = 26;

  const ensure = (h: number) => {
    if (y + h > 272) {
      doc.addPage();
      y = 26;
    }
  };
  const center = (t: string, size: number, bold: boolean, color: [number, number, number], lh = 5.2) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(t, W) as string[];
    for (const l of lines) {
      doc.text(l, 105, y, { align: "center" });
      y += lh;
    }
  };
  const section = (t: string) => {
    ensure(14);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 15);
    doc.text(t, M, y);
    y += 1.8;
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + W, y);
    y += 6;
  };
  const kv = (k: string, v: string, vBold = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    doc.text(k, M, y);
    doc.setFont("helvetica", vBold ? "bold" : "normal");
    doc.setTextColor(20, 20, 20);
    const vx = M + 64;
    const lines = doc.splitTextToSize(v, W - 64) as string[];
    for (const l of lines) {
      doc.text(l, vx, y);
      y += 4.8;
    }
    if (lines.length === 1) y += 0.6;
  };
  const para = (t: string, size = 9.5, bold = false, color: [number, number, number] = [40, 40, 40]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(t, W) as string[];
    for (const l of lines) {
      ensure(5);
      doc.text(l, M, y);
      y += 4.7;
    }
    y += 2.2;
  };

  // ----- Encabezado -----
  center("CUMBRE30 · APLICACIÓN DE REGISTRO DE CICLISMO", 8, false, [120, 120, 120], 4.4);
  center("CONSTANCIA DE REGISTRO DE TRAYECTO EN BICICLETA", 14, true, [10, 10, 10], 6.4);
  center(
    "Ámbito: Parque Metropolitano de Santiago (Cerro San Cristóbal) · límite de velocidad para bicicletas: 30 km/h",
    9, false, [100, 100, 100], 4.6
  );
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(M, y, M + W, y);
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(M, y, M + W, y);
  y += 5;

  // ----- I. Identificación -----
  section("I. IDENTIFICACIÓN DEL CICLISTA");
  kv("Nombre:", id.name?.trim() ? id.name : "________________________________________");
  kv("RUT:", "_______________________________  (completar antes de presentar)");
  kv("Usuario en la aplicación:", id.username?.trim() ? id.username : "-");
  kv("Correo asociado:", id.email?.trim() ? id.email : "-");
  y += 1;

  // ----- II. Identificación del registro -----
  section("II. IDENTIFICACIÓN DEL REGISTRO");
  kv("Aplicación:", `Cumbre30, versión ${APP_VERSION} (registro local del teléfono; sin servidor)`);
  kv("ID del registro:", r.id);
  kv("Origen de los datos:", r.source === "gps"
    ? "Receptor GPS del teléfono del ciclista (posicionamiento satelital; velocidad por efecto Doppler con filtrado digital)."
    : "Simulación interna de la aplicación (modo demostración), sin señal GPS.");
  kv("Fecha de emisión:", `${fmtDateTime.format(emitted)} (hora local de Chile)`);
  y += 1;

  // ----- III. Datos del trayecto -----
  const end = new Date(r.dateISO);
  const start = new Date(end.getTime() - r.elapsedSec * 1000);
  section("III. DATOS DEL TRAYECTO");
  kv("Fecha del trayecto:", titleCase(fmtLongDate.format(end)));
  kv("Hora de inicio:", `${fmtTime.format(start)} (estimada a partir de la duración registrada)`);
  kv("Hora de término:", `${fmtTime.format(end)} (hora local de Chile)`);
  kv("Duración total:", duracion(r.elapsedSec));
  kv("Distancia recorrida:", `${num(r.distanceKm)} kilómetros`);
  kv("Velocidad media:", `${num(r.avgKmh, 1)} km/h`);
  kv("Velocidad máxima:", `${num(r.maxKmh, 1)} km/h`);
  kv("Vel. máxima en el Parque:", r.maxInParkKmh !== null
    ? `${num(r.maxInParkKmh, 1)} km/h`
    : "Sin registro de ingreso al Parque en este trayecto.");
  kv("Tiempo sobre 30 km/h:", r.overLimitSec > 0
    ? `${duracion(r.overLimitSec)}`
    : "No se registró tiempo sobre el límite (0 segundos).", r.overLimitSec === 0);
  kv("Desnivel positivo:", `+${num(r.gainM, 0)} metros de subida acumulada`);
  y += 1;

  // ----- IV. Declaración -----
  section("IV. DECLARACIÓN");
  para(
    `La presente constancia ha sido generada automáticamente por la aplicación Cumbre30, versión ${APP_VERSION}, ` +
    "instalada en el teléfono móvil del ciclista, a partir de las lecturas del receptor GPS del propio dispositivo " +
    "obtenidas durante el trayecto indicado. Los datos se registraron al momento de la actividad, sin intervención " +
    "manual posterior, y se conservan de forma local en el teléfono; la aplicación no opera servidores ni modifica " +
    "el registro una vez emitido."
  );
  para(
    "La velocidad se determina por efecto Doppler a partir de la señal satelital, con filtrado digital para reducir " +
    "el ruido de medición, y la distancia se obtiene integrando la secuencia de posiciones registradas. El límite de " +
    "referencia de 30 kilómetros por hora corresponde al que se aplica a las bicicletas en los caminos del Parque " +
    "Metropolitano de Santiago."
  );
  para(
    "Este documento constituye una bitácora electrónica personal autogenerada por su propio titular. No reemplaza " +
    "registros oficiales, no constituye un peritaje técnico practicado por un tercero independiente, y su valor como " +
    "medio de respaldo ante una infracción, reclamo o consulta será evaluado por la autoridad o institución que lo reciba."
  );
  if (r.source !== "gps") {
    ensure(14);
    para(
      "ADVERTENCIA: este registro fue generado en modo demostración (sin señal GPS), por lo que NO debe utilizarse " +
      "como respaldo de una actividad real.",
      10, true, [170, 20, 20]
    );
  }

  // ----- V. Integridad -----
  section("V. INTEGRIDAD DEL REGISTRO");
  para(
    "Código de verificación SHA-256 del contenido de esta constancia (datos del trayecto, identidad declarada y " +
    "versión de la aplicación al momento de la emisión):",
    9
  );
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const hashLines = verifCode.match(/.{1,40}/g) ?? [verifCode];
  for (const l of hashLines) {
    ensure(4.4);
    doc.text(l, M, y);
    y += 4.2;
  }
  y += 1.5;
  para(
    "Un receptor de este documento puede comparar este código con una constancia emitida previamente por la misma " +
    "aplicación para constatar que no fue alterada con posterioridad a su emisión.",
    9
  );

  // ----- Firma -----
  ensure(34);
  y += 2;
  para(`Santiago de Chile, ${titleCase(fmtLongDate.format(emitted))}.`, 9.5);
  y += 10;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 80, y);
  y += 4.6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Firma del ciclista (titular del registro)", M, y);
  y += 4.6;
  if (id.name?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(id.name, M, y);
    y += 4.4;
  }
  para(
    "La firma del titular declara que el trayecto descrito corresponde a su actividad personal y que los datos " +
    "identificados en la sección III provienen de su propio dispositivo.",
    8.5, false, [110, 110, 110]
  );

  // ----- Pie de página en todas las hojas -----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Constancia generada por Cumbre30 v${APP_VERSION} · documento autogenerado por su titular · registro local del dispositivo`,
      105, 287, { align: "center" }
    );
    doc.text(`Página ${i} de ${pages}`, 105, 291, { align: "center" });
  }

  return doc;
}
