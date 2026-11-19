/**
 * rideBackfill — recálculo de métricas de rides antiguos (v1.13.17,
 * fase 2 del Perfil Ciclista).
 *
 * Los rides grabados antes de v1.13.16 no tienen métricas derivadas y
 * el perfil solo los usa para Resistencia/Constancia/densidad: VAM,
 * Velocidad, Explosividad y Exploración quedaban en cero hasta que el
 * ciclista acumuló rides nuevos. Como las pistas siguen en el teléfono
 * (IndexedDB), al reconectar recalculamos las métricas EN EL DISPOSITIVO
 * (el track crudo nunca sale antes de derivarse) y las subimos por la
 * vía normal (POST /api/rides es idempotente por clientId: el servidor
 * las añade a un ride ya existente).
 *
 * Presupuesto: máx. BACKFILL_LOTE rides por arranque — el trabajo corre
 * en segundo plano 12 s después de abrir la app y no compite con el
 * GPS ni con el primer render. Los rides sin métricas posibles (demo,
 * muy cortos, sin pista) quedan marcados metricsTried para no reintentar.
 */
import { historyStore, patchRideMetrics, readRideTrack, ridesForAccount, type RideSummary } from "@/lib/history";
import { computeRideMetrics } from "@/lib/rideMetrics";
import { computeOffRoadKm } from "@/lib/rideOffroad";
import { getRideWeights } from "@/lib/rideWeights";
import { loadNetwork } from "@/lib/routing";
import { syncRideAfterSave } from "@/lib/sync";

/** Máx. rides recalculados por arranque (presupuesto de CPU/batería). */
export const BACKFILL_LOTE = 8;

/** Rides en cuenta que aún pueden producir métricas desde su pista. */
function candidatos(rides: RideSummary[], email: string): RideSummary[] {
  return ridesForAccount(rides, email).filter(
    (r) =>
      r.source === "gps" &&
      r.motorized !== true &&
      !r.metrics &&
      !r.metricsTried
  );
}

/**
 * Recalcula métricas de hasta `max` rides sin métricas y las sube.
 * Devuelve cuántos rides quedaron procesados (con o sin métricas).
 * Silencioso: sin sesión, sin pista o con la red caída no hace nada.
 */
export async function runMetricBackfill(email: string, max = BACKFILL_LOTE): Promise<number> {
  const mail = email.trim().toLowerCase();
  if (!mail) return 0;
  const pendientes = candidatos(historyStore.get(), mail).slice(0, max);
  if (!pendientes.length) return 0;

  // La red de navegación se carga una vez para enriquecer con off-road;
  // si no está disponible el backfill igual corre (solo ejes de métricas).
  const net = await loadNetwork().catch(() => null);

  let procesados = 0;
  for (const ride of pendientes) {
    try {
      const track = await readRideTrack(ride.id);
      if (!track || track.length < 3) {
        patchRideMetrics(ride.id, null); // marca el intento: no habrá métricas
        procesados++;
        continue;
      }
      const m = computeRideMetrics(track, getRideWeights());
      if (!m) {
        patchRideMetrics(ride.id, null);
        procesados++;
        continue;
      }
      if (net) {
        const off = computeOffRoadKm(track, net);
        if (off.netKm >= 0.3) {
          m.offRoadKm = off.offRoadKm;
          m.netKm = off.netKm;
        }
      }
      patchRideMetrics(ride.id, m);
      // Sube por la vía normal: web POST directo, APK outbox offline.
      // El ride viejo ya existe en el servidor → dedup → métricas añadidas.
      await syncRideAfterSave({ ...ride, metrics: m });
      procesados++;
    } catch {
      // un ride fallido no aborta el lote; quedará sin metricsTried
      // para reintentar en el próximo arranque
    }
  }
  return procesados;
}
