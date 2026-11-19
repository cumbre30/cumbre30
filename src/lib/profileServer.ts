/**
 * profileServer — motor del Perfil Ciclista (fase 1, v1.13.16).
 *
 * Adaptación pragmática del spec "perfil ciclista v1": en lugar de un
 * pipeline event-driven con workers (S3/Lambda/BullMQ — sobredimensionado
 * para esta escala), el recálculo corre inline al consultar el perfil y
 * al guardar un ride. Los denominadores (25 m/km, 90 km, 36 / 52 km/h)
 * son del spec; quedan como constantes locales para futura Remote Config.
 *
 * Reglas:
 *  · Ventana móvil de 90 días, peso w = e^(−0.015·días) (vida media ~45 d).
 *  · Solo rides GPS no motorizados. Los rides previos a v1.13.16 (sin
 *    métricas derivadas) cuentan para Resistencia, Constancia y la parte
 *    de densidad de Escalada (vía Ride.gainM); VAM/Velocidad/Explosividad
 *    solo con métricas — el perfil se afina solo con rides nuevos.
 *  · Antitrampa: >55 km/h sostenido ≥2 min o >28 km/h en pendiente >6%
 *    marca la métrica inválida (spec §6) y el ride sale del perfil.
 *  · Calibración: con <5 rutas válidas el arquetipo es CALIBRATING.
 *  · Arquetipo (en orden): URBAN (≥70% de rutas urbanas con métricas)
 *    → especialista si el eje máximo le saca ≥15 al segundo
 *    (CLIMBER/ENDURANCE/TIME_TRIALIST/SPRINTER) → ALL_ROUNDER.
 */
import { db } from "@/lib/db";

const VENTANA_DIAS = 90;
const LAMBDA = 0.015;
const MIN_RUTAS = 5;
const SEMANAS = 12;
// Techos amateur avanzados del spec (score 100).
const TECHO_MKM = 25; // m de desnivel por km
const TECHO_VAM = 1100; // m/h
const TECHO_ENDU = 90; // km (promedio top-3)
const TECHO_LLANO = 36; // km/h
const TECHO_PICO = 52; // km/h (P95 de picos)

// ---------- autorreparo de tablas (espejo de Prisma) ----------
// Como las columnas de Incident (Ola 1) y PushSub: CREATE TABLE IF NOT
// EXISTS al primer uso — despliegue sin migración manual.
let tablasListas: Promise<void> | null = null;

export function asegurarTablasPerfil(): Promise<void> {
  tablasListas ??= (async () => {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "RideMetric" (
        "rideId" TEXT NOT NULL PRIMARY KEY,
        "movingSec" DOUBLE PRECISION NOT NULL,
        "peak15sKmh" DOUBLE PRECISION,
        "flatAvgKmh" DOUBLE PRECISION,
        "flatKm" DOUBLE PRECISION,
        "climbGainM" DOUBLE PRECISION,
        "climbSec" DOUBLE PRECISION,
        "vamMh" DOUBLE PRECISION,
        "stopCount" INTEGER,
        "secOver55" DOUBLE PRECISION,
        "over55StreakSec" DOUBLE PRECISION,
        "climb6AvgKmh" DOUBLE PRECISION,
        "isValid" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RideMetric_rideId_fkey" FOREIGN KEY ("rideId")
          REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`
    );
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "CyclistProfile" (
        "userId" TEXT NOT NULL PRIMARY KEY,
        "archetype" TEXT NOT NULL,
        "calibrating" BOOLEAN NOT NULL DEFAULT true,
        "climbing" DOUBLE PRECISION,
        "endurance" DOUBLE PRECISION,
        "speed" DOUBLE PRECISION,
        "power" DOUBLE PRECISION,
        "consistency" DOUBLE PRECISION,
        "validRides" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CyclistProfile_userId_fkey" FOREIGN KEY ("userId")
          REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`
    );
  })().catch((e) => {
    tablasListas = null; // permite reintento en la siguiente petición
    throw e;
  });
  return tablasListas;
}

// ---------- tipos de salida ----------

export type PerfilSummary = {
  archetype: string;
  calibrating: boolean;
  scores: {
    climbing: number | null;
    endurance: number | null;
    speed: number | null;
    power: number | null;
    consistency: number | null;
  };
  validRides: number;
  extras: {
    vamAvg: number | null;
    mkmAvg: number | null;
    flatAvg: number | null;
    peak95: number | null;
    activeWeeks: number;
    stopsPerKm: number | null;
  };
  /** Rides que alimentan el perfil (12 últimos) + excluidos (5 últimos). */
  rides: Array<{
    dateISO: string;
    distanceKm: number;
    gainM: number;
    w: number | null;
    excl: string | null; // null | "motorizado" | "invalida"
  }>;
};

/** Peso por frescura: w = e^(−λ·días). */
function peso(dateISO: Date, ahora: number): number {
  const dias = Math.max(0, (ahora - dateISO.getTime()) / 86400e3);
  return Math.exp(-LAMBDA * dias);
}

/** Percentil p ponderado (recorre acumulando pesos en orden ascendente). */
function pctil(vals: number[], pesos: number[], p: number): number | null {
  if (!vals.length) return null;
  const orden = vals.map((v, i) => [v, pesos[i]] as const).sort((a, b) => a[0] - b[0]);
  const total = orden.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of orden) {
    acc += w;
    if (acc >= total * p) return v;
  }
  return orden[orden.length - 1][0];
}

/** Semana ISO (lunes) de una fecha, como "YYYY-MM-DD". */
function semanaISO(d: Date): string {
  const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
}

/** Arquetipo por las reglas del spec (§5), con los ejes ya calculados. */
function clasificar(
  calibrating: boolean,
  scores: PerfilSummary["scores"],
  valid: Array<{ dateISO: Date; distanceKm: number; metric: { stopCount: number | null } | null }>
): string {
  if (calibrating) return "CALIBRATING";
  // URBAN: cortas + horario punta L-V + muchas paradas. Solo evaluable
  // donde hay métricas de paradas; exige un mínimo de rutas con métrica.
  const conMetric = valid.filter((r) => r.metric && r.metric.stopCount !== null);
  if (conMetric.length >= MIN_RUTAS) {
    const urbanas = conMetric.filter((r) => {
      const d = r.dateISO;
      const hora = (d.getUTCHours() + 21) % 24; // Chile continental (UTC-3), aprox.
      const dia = d.getUTCDay();
      const punta = dia >= 1 && dia <= 5 && ((hora >= 7 && hora < 9) || (hora >= 17 && hora < 19));
      const corta = r.distanceKm < 15;
      const paradas = (r.metric!.stopCount ?? 0) / Math.max(1, r.distanceKm) > 1 / 1.5;
      return corta && punta && paradas;
    });
    if (urbanas.length / conMetric.length > 0.7) return "URBAN";
  }
  // Especialización: eje máximo con ≥15 pts sobre el segundo.
  const ejes: Array<[string, number]> = [];
  if (scores.climbing !== null) ejes.push(["climbing", scores.climbing]);
  if (scores.endurance !== null) ejes.push(["endurance", scores.endurance]);
  if (scores.speed !== null) ejes.push(["speed", scores.speed]);
  if (scores.power !== null) ejes.push(["power", scores.power]);
  ejes.sort((a, b) => b[1] - a[1]);
  if (ejes.length >= 2 && ejes[0][1] - ejes[1][1] >= 15) {
    const mapa: Record<string, string> = {
      climbing: "CLIMBER",
      endurance: "ENDURANCE",
      speed: "TIME_TRIALIST",
      power: "SPRINTER",
    };
    return mapa[ejes[0][0]];
  }
  return "ALL_ROUNDER";
}

/**
 * Recalcula el perfil del ciclista con los rides de los últimos 90 días,
 * actualiza el documento materializado y devuelve el resumen para la UI.
 */
export async function recalcularPerfil(userId: string): Promise<PerfilSummary> {
  await asegurarTablasPerfil();
  const desde = new Date(Date.now() - VENTANA_DIAS * 86400e3);
  const rides = await db.ride.findMany({
    where: { userId, dateISO: { gte: desde }, source: "gps", motorized: false },
    include: { metric: true },
    orderBy: { dateISO: "desc" },
    take: 200,
  });
  const ahora = Date.now();

  // Antitrampa (spec §6): física imposible en bici → métrica inválida.
  for (const r of rides) {
    const m = r.metric;
    if (!m) continue;
    const trampa = (m.over55StreakSec ?? 0) >= 120 || (m.climb6AvgKmh ?? 0) > 28;
    if (trampa && m.isValid) {
      await db.rideMetric.update({ where: { rideId: m.rideId }, data: { isValid: false } });
      m.isValid = false;
    }
  }
  const valid = rides.filter((r) => !r.metric || r.metric.isValid);

  // --- 5 ejes ---
  // Resistencia: promedio de las 3 rutas más largas de la ventana.
  const top3 = [...valid].sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 3);
  const endurance = top3.length
    ? Math.min(100, ((top3.reduce((s, r) => s + r.distanceKm, 0) / top3.length) / TECHO_ENDU) * 100)
    : null;

  // Constancia: semanas con ≥2 rides en las últimas 12 semanas.
  const conteo = new Map<string, number>();
  for (const r of valid) conteo.set(semanaISO(r.dateISO), (conteo.get(semanaISO(r.dateISO)) ?? 0) + 1);
  const activeWeeks = [...conteo.values()].filter((c) => c >= 2).length;
  const consistency = Math.min(100, (activeWeeks / SEMANAS) * 100);

  // Escalada: densidad de desnivel (todos) + VAM (rides con métricas).
  let wSum = 0;
  let mkmSum = 0;
  let vamWSum = 0;
  let vamSum = 0;
  let stopsWSum = 0;
  let stopsKmSum = 0;
  for (const r of valid) {
    const wi = peso(r.dateISO, ahora);
    if (r.distanceKm >= 1) {
      wSum += wi;
      mkmSum += wi * (r.gainM / r.distanceKm);
      const sc = r.metric?.stopCount;
      if (sc !== null && sc !== undefined) {
        stopsWSum += wi;
        stopsKmSum += wi * (sc / Math.max(1, r.distanceKm));
      }
    }
    const vam = r.metric?.vamMh;
    if (vam && vam > 0) {
      vamWSum += wi;
      vamSum += wi * vam;
    }
  }
  const mkmAvg = wSum > 0 ? mkmSum / wSum : null;
  const vamAvg = vamWSum > 0 ? vamSum / vamWSum : null;
  const climbing =
    mkmAvg === null
      ? null
      : vamAvg !== null
        ? Math.min(100, ((0.6 * mkmAvg) / TECHO_MKM + (0.4 * vamAvg) / TECHO_VAM) * 100)
        : Math.min(100, (mkmAvg / TECHO_MKM) * 100);

  // Velocidad: media ponderada en tramos llanos (|pendiente| ≤ 1.5%).
  let spWSum = 0;
  let spSum = 0;
  for (const r of valid) {
    const f = r.metric?.flatAvgKmh;
    if (f && f > 0) {
      const wi = peso(r.dateISO, ahora);
      spWSum += wi;
      spSum += wi * f;
    }
  }
  const flatAvg = spWSum > 0 ? spSum / spWSum : null;
  const speed = flatAvg !== null ? Math.min(100, (flatAvg / TECHO_LLANO) * 100) : null;

  // Explosividad: P95 ponderado de los picos por ride (spec: evita el
  // máximo absoluto por si quedó un error de GPS).
  const peaks: number[] = [];
  const pesos: number[] = [];
  for (const r of valid) {
    const p = r.metric?.peak15sKmh;
    if (p && p > 0) {
      const wi = peso(r.dateISO, ahora);
      peaks.push(p);
      pesos.push(wi);
    }
  }
  const peak95 = pctil(peaks, pesos, 0.95);
  const power = peak95 !== null ? Math.min(100, (peak95 / TECHO_PICO) * 100) : null;

  const calibrating = valid.length < MIN_RUTAS;
  const scores = { climbing, endurance, speed, power, consistency };
  const archetype = clasificar(calibrating, scores, valid);

  // Feed para la UI: 12 válidos más recientes + 5 excluidos.
  const ridesOut: PerfilSummary["rides"] = valid.slice(0, 12).map((r) => ({
    dateISO: r.dateISO.toISOString(),
    distanceKm: r.distanceKm,
    gainM: r.gainM,
    w: Math.round(peso(r.dateISO, ahora) * 100) / 100,
    excl: null,
  }));
  const excluidos = rides
    .filter((r) => r.metric && !r.metric.isValid)
    .slice(0, 5)
    .map((r) => ({
      dateISO: r.dateISO.toISOString(),
      distanceKm: r.distanceKm,
      gainM: r.gainM,
      w: null,
      excl: "invalida" as const,
    }));
  for (const r of excluidos) {
    ridesOut.push(r);
  }
  const motorizados = await db.ride.findMany({
    where: { userId, dateISO: { gte: desde }, motorized: true },
    orderBy: { dateISO: "desc" },
    take: 5,
    select: { dateISO: true, distanceKm: true, gainM: true },
  });
  for (const r of motorizados) {
    ridesOut.push({
      dateISO: r.dateISO.toISOString(),
      distanceKm: r.distanceKm,
      gainM: r.gainM,
      w: null,
      excl: "motorizado",
    });
  }

  const summary: PerfilSummary = {
    archetype,
    calibrating,
    scores,
    validRides: valid.length,
    extras: {
      vamAvg: vamAvg !== null ? Math.round(vamAvg) : null,
      mkmAvg: mkmAvg !== null ? Math.round(mkmAvg * 10) / 10 : null,
      flatAvg: flatAvg !== null ? Math.round(flatAvg * 10) / 10 : null,
      peak95: peak95 !== null ? Math.round(peak95 * 10) / 10 : null,
      activeWeeks,
      stopsPerKm: stopsWSum > 0 ? Math.round((stopsKmSum / stopsWSum) * 10) / 10 : null,
    },
    rides: ridesOut,
  };

  // Documento materializado (lectura rápida / histórico del arquetipo).
  const data = {
    archetype,
    calibrating,
    climbing,
    endurance,
    speed,
    power,
    consistency,
    validRides: valid.length,
    updatedAt: new Date(),
  };
  await db.cyclistProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return summary;
}
