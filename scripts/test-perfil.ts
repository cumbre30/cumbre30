/**
 * Test sintético del motor del Perfil Ciclista (fase 1).
 * Ejecutar: DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 bun run scripts/test-perfil.ts
 * Crea un usuario de prueba, le inyecta rides con métricas controladas
 * y verifica: CALIBRATING (<5), CLIMBER (eje dominante ≥15), exclusión
 * de motorizados y de rides imposibles (antitrampa), y el materializado.
 */
import { db } from "@/lib/db";
import { asegurarTablasPerfil, recalcularPerfil } from "@/lib/profileServer";

const EMAIL = "test-perfil@cumbre30.test";
let fallos = 0;
function check(nombre: string, ok: boolean, detalle = "") {
  console.log(`${ok ? "✓" : "✗"} ${nombre}${detalle ? " — " + detalle : ""}`);
  if (!ok) fallos++;
}

const dAtras = (dias: number) => new Date(Date.now() - dias * 86400e3);

async function crearRide(
  userId: string,
  dateISO: Date,
  km: number,
  gainM: number,
  metric: Record<string, number | null> | null,
  motorized = false,
) {
  const ride = await db.ride.create({
    data: {
      userId,
      dateISO,
      source: "gps",
      distanceKm: km,
      maxKmh: 40,
      avgKmh: km / ((km / 22) * 3600 / 3600) || 22,
      elapsedSec: (km / 22) * 3600,
      gainM,
      overLimitSec: 0,
      motorized,
      clientId: `test-${crypto.randomUUID().slice(0, 8)}`,
    },
  });
  if (metric) {
    await db.rideMetric.create({
      data: {
        rideId: ride.id,
        movingSec: (km / 22) * 3600,
        peak15sKmh: metric.peak15sKmh ?? null,
        flatAvgKmh: metric.flatAvgKmh ?? null,
        flatKm: metric.flatKm ?? null,
        climbGainM: metric.climbGainM ?? null,
        climbSec: metric.climbSec ?? null,
        vamMh: metric.vamMh ?? null,
        stopCount: metric.stopCount != null ? Math.round(metric.stopCount) : null,
        secOver55: metric.secOver55 ?? 0,
        over55StreakSec: metric.over55StreakSec ?? 0,
        climb6AvgKmh: metric.climb6AvgKmh ?? null,
      },
    });
  }
  return ride;
}

async function main() {
  await asegurarTablasPerfil();
  await db.user.deleteMany({ where: { email: EMAIL } }); // limpia ejecución previa
  const user = await db.user.create({
    data: { email: EMAIL, username: "testperfil", passwordHash: "x" },
  });

  // --- 1. Calibración: 3 rides → CALIBRATING ---
  for (let i = 0; i < 3; i++) {
    await crearRide(user.id, dAtras(i + 1), 10 + i, 120 + i * 30, {
      flatAvgKmh: 24, flatKm: 8, peak15sKmh: 33, climbGainM: 120, climbSec: 1500, vamMh: 288, stopCount: 2,
    });
  }
  let p = await recalcularPerfil(user.id);
  check("1a. <5 rutas → CALIBRATING", p.archetype === "CALIBRATING" && p.calibrating, p.archetype);
  check("1b. ejes calculados aún así (endurance)", p.scores.endurance !== null, `endurance=${p.scores.endurance?.toFixed(1)}`);

  // --- 2. Especialista: 5 rides de montaña → CLIMBER ---
  // 12 km con +500 m → 41.7 m/km (score ~100 en la parte de densidad),
  // VAM ~600 (muy sobre 288 inicial) → el eje domina por >15 pts.
  for (let i = 0; i < 5; i++) {
    await crearRide(user.id, dAtras(i + 5), 12, 500, {
      flatAvgKmh: 26, flatKm: 6, peak15sKmh: 38, climbGainM: 500, climbSec: 3000, vamMh: 600, stopCount: 1,
    });
  }
  p = await recalcularPerfil(user.id);
  check("2a. 8 rutas → calibrado", !p.calibrating, `validRides=${p.validRides}`);
  check("2b. arquetipo CLIMBER", p.archetype === "CLIMBER", p.archetype);
  // El promedio ponderado mezcla los 3 rides livianos (mkm ~13) con los 5
  // de montaña (mkm ~42): el techo 100 no se alcanza con esta mezcla, lo
  // que importa es el dominio ≥15 sobre el segundo eje.
  check("2c. climbing dominante (>85 y ≥15 sobre endurance)", (p.scores.climbing ?? 0) > 85 && (p.scores.climbing ?? 0) - (p.scores.endurance ?? 0) >= 15, `climbing=${p.scores.climbing?.toFixed(1)} endurance=${p.scores.endurance?.toFixed(1)}`);
  // VAM ponderado: 3×288 (frescos) + 5×600 (montaña) ≈ 477.
  check("2d. extras VAM ponderado ~477", p.extras.vamAvg !== null && p.extras.vamAvg! > 460 && p.extras.vamAvg! < 495, `vam=${p.extras.vamAvg}`);

  // --- 3. Motorizado excluido (aunque sea gigante) ---
  await crearRide(user.id, dAtras(2), 120, 3000, { flatAvgKmh: 80, flatKm: 110, peak15sKmh: 120, stopCount: 0 }, true);
  const antes = p.scores.endurance!;
  p = await recalcularPerfil(user.id);
  check("3. motorizado no entra (endurance intacta)", Math.abs(p.scores.endurance! - antes) < 0.01, `endurance=${p.scores.endurance?.toFixed(1)}`);
  check("3b. aparece en el feed como excluido", p.rides.some((r) => r.excl === "motorizado"), "");

  // --- 4. Antitrampa: ride imposible en bici → inválido ---
  await crearRide(user.id, dAtras(1), 60, 100, {
    flatAvgKmh: 70, flatKm: 55, peak15sKmh: 95, secOver55: 400, over55StreakSec: 180, stopCount: 0,
  });
  p = await recalcularPerfil(user.id);
  check("4a. ride imposible → excluido del perfil", !p.rides.some((r) => r.excl === null && r.distanceKm > 50), `validRides=${p.validRides}`);
  check("4b. marcado en el feed", p.rides.some((r) => r.excl === "invalida"), "");
  const m = await db.rideMetric.findFirst({ where: { ride: { userId: user.id, distanceKm: 60 } } });
  check("4c. isValid=false persistido", m?.isValid === false, "");

  // --- 5. Materializado guardado ---
  const mat = await db.cyclistProfile.findUnique({ where: { userId: user.id } });
  check("5. CyclistProfile materializado", mat?.archetype === "CLIMBER" && mat!.validRides === p.validRides, mat?.archetype);

  await db.user.delete({ where: { id: user.id } }); // cascade borra rides+metrics+profile
  console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
