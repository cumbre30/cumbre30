// ============================================================
// Rachas de actividad (Ola 1).
// ------------------------------------------------------------
// Días y semanas consecutivas con al menos un ride, calculadas
// desde el historial local. Un ride "del día" es el día calendario
// en Santiago (TZ America/Santiago), no el del teléfono: un turista
// con el celular en otra zona horaria no rompe la racha.
//
//   · actual: consecutiva al día de HOY o a AYER (perdonar el día
//     sin pedalear aún no cierra la racha).
//   · máxima: la más larga del historial completo.
// ============================================================

import { t } from "./i18n_test.ts";

const TZ = "America/Santiago";

/** Día calendario de un ride (YYYY-MM-DD en hora de Santiago). */
export function diaDeRide(dateISO: string): string {
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA → YYYY-MM-DD
}

/** Lunes de la semana (YYYY-MM-DD en Santiago) de un día. */
function semanaDe(dia: string): string {
  // Parseo UTC del día calendario para no depender del reloj local.
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=domingo
  const delta = dow === 0 ? -6 : 1 - dow; // lunes como inicio
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function sumarDia(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function diaEnSantiago(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type Rachas = {
  diasActual: number;
  diasMaxima: number;
  semanasActual: number;
  semanasMaxima: number;
  diasTotales: number; // días distintos con ride en el historial
};

/** Rachas desde la lista de rides (cualquier orden; dedupe incluido). */
export function rachasDe(rides: { dateISO: string }[], now: Date = new Date()): Rachas {
  const dias = Array.from(new Set(rides.map((r) => diaDeRide(r.dateISO)).filter(Boolean))).sort();
  const hoy = diaEnSantiago(now);

  // Racha de días: recorrer hacia atrás desde hoy (o ayer).
  let inicio = hoy;
  if (!dias.includes(hoy)) inicio = sumarDia(hoy, -1);
  let diasActual = 0;
  if (dias.includes(inicio)) {
    let cursor = inicio;
    while (dias.includes(cursor)) {
      diasActual += 1;
      cursor = sumarDia(cursor, -1);
    }
  }

  // Máxima de días: recorrido lineal de la lista ordenada.
  let diasMaxima = 0;
  let run = 0;
  let prev = "";
  for (const d of dias) {
    run = prev && sumarDia(prev, 1) === d ? run + 1 : 1;
    if (run > diasMaxima) diasMaxima = run;
    prev = d;
  }

  // Semanas: agrupar por lunes de la semana.
  const semanas = Array.from(new Set(dias.map(semanaDe))).sort();
  const semanaHoy = semanaDe(hoy);
  let inicioSem = semanaHoy;
  if (!semanas.includes(inicioSem)) inicioSem = semanaDe(sumarDia(hoy, -7));
  let semanasActual = 0;
  if (semanas.includes(inicioSem)) {
    let cursor = inicioSem;
    while (semanas.includes(cursor)) {
      semanasActual += 1;
      cursor = semanaDe(sumarDia(cursor, -7));
    }
  }
  let semanasMaxima = 0;
  run = 0;
  prev = "";
  for (const s of semanas) {
    run = prev && semanaDe(sumarDia(prev, 7)) === s ? run + 1 : 1;
    if (run > semanasMaxima) semanasMaxima = run;
    prev = s;
  }

  return {
    diasActual,
    diasMaxima,
    semanasActual,
    semanasMaxima,
    diasTotales: dias.length,
  };
}

/** "1 día", "3 días" — plural simple por idioma. */
export function textoDias(n: number): string {
  return t("racha.dias", n);
}
