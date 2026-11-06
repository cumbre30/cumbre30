// ============================================================
// Estadísticas avanzadas (PRO) — resumen mensual del historial.
// Función PURA sobre la lista de rides (ya filtrada por cuenta y
// bici: caller usa bikeOnly(ridesForAccount(...))). Sin React ni
// storage, así que se puede testear en node (test-freemium.ts).
// ============================================================

import type { RideSummary } from "./history";

export type MonthBucket = {
  /** "2026-11" */
  ym: string;
  /** "nov" */
  label: string;
  km: number;
  rides: number;
  timeSec: number;
  gainM: number;
};

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Últimos `months` meses (incluido el actual), en orden cronológico,
 * con ceros donde no hubo rides. Ignora vehicle motorizado por si el
 * caller no filtró.
 */
export function monthlyBuckets(rides: RideSummary[], months = 6, now = new Date()): MonthBucket[] {
  const n = Math.max(1, months);
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    labels.push(MES_CORTO[d.getMonth()]);
  }
  const by = new Map<string, MonthBucket>(
    keys.map((k, i) => [k, { ym: k, label: labels[i], km: 0, rides: 0, timeSec: 0, gainM: 0 }]),
  );
  for (const r of rides) {
    if (r.motorized) continue;
    const b = by.get(r.dateISO.slice(0, 7));
    if (!b) continue;
    b.km += r.distanceKm;
    b.rides += 1;
    b.timeSec += r.elapsedSec;
    b.gainM += r.gainM;
  }
  return keys.map((k) => by.get(k)!);
}

/** Mejor mes por kilómetros dentro de los buckets dados. */
export function bestMonth(buckets: MonthBucket[]): MonthBucket | null {
  return buckets.reduce<MonthBucket | null>(
    (best, b) => (best == null || b.km > best.km ? b : best),
    null,
  );
}

/** Variación de km del último mes vs el anterior (p. ej. "+12,4"). */
export function deltaVsPrev(buckets: MonthBucket[], decimals = 1): string | null {
  if (buckets.length < 2) return null;
  const prev = buckets[buckets.length - 2].km;
  const cur = buckets[buckets.length - 1].km;
  const d = cur - prev;
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  return `${sign}${Math.abs(d).toFixed(decimals).replace(".", ",")} km`;
}
