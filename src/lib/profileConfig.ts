/**
 * profileConfig — techos del Perfil Ciclista como Remote Config
 * (fase 2, v1.13.17). Los denominadores del spec (25 m/km, 90 km,
 * 36 / 52 km/h) dejaron de ser constantes de código: viven en la
 * tabla ProfileConfig (una fila por clave) y se pueden recalibrar con
 * telemetría real sin publicar release.
 *
 *   GET  /api/profile-config  → valores vigentes (con defaults mezclados)
 *   PUT  /api/profile-config  → actualiza claves (x-admin-key, patrón
 *                               /api/licencia: ADMIN_KEY timing-safe)
 *
 * El motor (profileServer) mezcla la BD con los defaults al recalcular,
 * con caché en memoria de 60 s para no sumar una query por petición.
 */
import { db } from "@/lib/db";

export type TechoKey =
  | "techoMkm" // Escalada: m de desnivel por km (score 100)
  | "techoVam" // Escalada: VAM m/h (score 100, peso 0.4)
  | "techoEndu" // Resistencia: km promedio del top-3 (score 100)
  | "techoLlano" // Velocidad: km/h en llano ±1.5% (score 100)
  | "techoPico" // Explosividad: P95 de picos km/h (score 100)
  | "techoOffroad"; // Exploración: km off-road promedio del top-3 (score 100)

export const TECHO_DEFAULTS: Record<TechoKey, number> = {
  techoMkm: 25,
  techoVam: 1100,
  techoEndu: 90,
  techoLlano: 36,
  techoPico: 52,
  techoOffroad: 20,
};

/** Rangos válidos por clave: un error de tipeo en el PUT no puede
 *  arrastrar los perfiles de todos los usuarios. */
export const TECHO_RANGOS: Record<TechoKey, [number, number]> = {
  techoMkm: [5, 100],
  techoVam: [300, 3000],
  techoEndu: [20, 300],
  techoLlano: [15, 60],
  techoPico: [25, 90],
  techoOffroad: [3, 100],
};

export type Techos = Record<TechoKey, number>;

// ---------- autorreparo (espejo de Prisma) ----------
// Igual que RideMetric/CyclistProfile: CREATE TABLE IF NOT EXISTS al
// primer uso — despliegue sin migración manual.
let tablaLista: Promise<void> | null = null;

export function asegurarTablaConfig(): Promise<void> {
  tablaLista ??= (async () => {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ProfileConfig" (
        "key" TEXT NOT NULL PRIMARY KEY,
        "value" DOUBLE PRECISION NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
  })().catch((e) => {
    tablaLista = null; // permite reintento en la siguiente petición
    throw e;
  });
  return tablaLista;
}

// ---------- lectura ----------
// Sin caché en memoria a propósito: un SELECT de 6 filas por petición es
// despreciable junto a la query de rides del recálculo, y así un PUT de
// Remote Config es efectivo AL INSTANTE (en serverless cada ruta tiene
// su propio módulo: una caché por proceso desincronizaría los techos
// hasta 60 s después de cada recalibración).

/** Techos vigentes: fila de BD por clave + defaults para el resto. */
export async function cargarTechos(): Promise<Techos> {
  const techos: Techos = { ...TECHO_DEFAULTS };
  try {
    await asegurarTablaConfig();
    const filas = await db.$queryRawUnsafe<Array<{ key: string; value: number }>>(
      `SELECT "key", "value" FROM "ProfileConfig"`
    );
    for (const f of filas) {
      if ((TECHO_DEFAULTS as Record<string, number>)[f.key] !== undefined && isFinite(f.value)) {
        techos[f.key as TechoKey] = f.value;
      }
    }
  } catch {
    // BD sin la tabla o caída: los defaults del spec siguen vigentes
  }
  return techos;
}

/**
 * Valida y guarda un lote parcial de claves. Devuelve el objeto con
 * claves rechazadas ("clave": motivo) o null si el body no trae nada
 * utilizable. El rechazo de UNA clave no bloquea a las demás.
 */
export async function guardarTechos(
  body: Record<string, unknown>
): Promise<{ guardado: Partial<Techos>; rechazado: Record<string, string> } | null> {
  const guardado: Partial<Techos> = {};
  const rechazado: Record<string, string> = {};
  for (const k of Object.keys(TECHO_DEFAULTS) as TechoKey[]) {
    if (!(k in body)) continue;
    const v = typeof body[k] === "number" ? body[k] : Number(body[k]);
    if (!isFinite(v)) {
      rechazado[k] = "no es un número";
      continue;
    }
    const [min, max] = TECHO_RANGOS[k];
    if (v < min || v > max) {
      rechazado[k] = `fuera de rango (${min}–${max})`;
      continue;
    }
    guardado[k] = Math.round(v * 100) / 100;
  }
  if (!Object.keys(guardado).length) return null;
  await asegurarTablaConfig();
  for (const [k, v] of Object.entries(guardado)) {
    await db.$executeRawUnsafe(
      `INSERT INTO "ProfileConfig" ("key", "value", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = CURRENT_TIMESTAMP`,
      k,
      v
    );
  }
  return { guardado, rechazado };
}
