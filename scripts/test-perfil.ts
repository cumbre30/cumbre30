/**
 * Test sintético del motor del Perfil Ciclista (fase 1 + fase 2).
 * Ejecutar: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/cumbre30 bun run scripts/test-perfil.ts
 * Crea un usuario de prueba, le inyecta rides con métricas controladas
 * y verifica: CALIBRATING (<5), CLIMBER (eje dominante ≥15), exclusión
 * de motorizados y de rides imposibles (antitrampa), el materializado,
 * y en fase 2 el eje EXPLORER (off-road top-3) con la Remote Config de
 * techos (guardarTechos recalibra sin release).
 */
import { db } from "@/lib/db";
import { asegurarTablasPerfil, recalcularPerfil } from "@/lib/profileServer";
import { guardarTechos } from "@/lib/profileConfig";

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
        offRoadKm: metric.offRoadKm ?? null,
        netKm: metric.netKm ?? null,
        estWattsClimb: metric.estWattsClimb ?? null,
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
  check("5b. sin off-road medido → explorer null (sin datos, no cero)", p.scores.explorer === null, `explorer=${p.scores.explorer}`);

  await db.user.delete({ where: { id: user.id } }); // cascade borra rides+metrics+profile

  // --- 6. Eje EXPLORER (fase 2): off-road top-3 define el arquetipo ---
  // 5 rutas de 18 km con 18 km off-road medidos (netKm 17.5 ≥ 0.3):
  // explorer = min(100, 18/20·100) = 90 → domina a velocidad (22/36 ≈ 61).
  const EMAIL2 = "test-perfil-exp@cumbre30.test";
  await db.user.deleteMany({ where: { email: EMAIL2 } });
  const u2 = await db.user.create({
    data: { email: EMAIL2, username: "testperfilexp", passwordHash: "x" },
  });
  for (let i = 0; i < 5; i++) {
    await crearRide(u2.id, dAtras(i + 1), 18, 50, {
      flatAvgKmh: 22, flatKm: 10, peak15sKmh: 28, climbGainM: 30, climbSec: 300, vamMh: 360, stopCount: 1,
      offRoadKm: 18, netKm: 17.5, estWattsClimb: 200,
    });
  }
  p = await recalcularPerfil(u2.id);
  check("6a. arquetipo EXPLORER", p.archetype === "EXPLORER", p.archetype);
  check("6b. explorer = 18/20 techo → 90", p.scores.explorer !== null && Math.abs(p.scores.explorer! - 90) < 0.5, `explorer=${p.scores.explorer?.toFixed(1)}`);
  check("6c. extras offRoadTop3 = 18", p.extras.offRoadTop3 === 18, `offRoadTop3=${p.extras.offRoadTop3}`);
  check("6d. extras estWatts = 200", p.extras.estWatts === 200, `estWatts=${p.extras.estWatts}`);
  const mat2 = await db.cyclistProfile.findUnique({ where: { userId: u2.id } });
  check("6e. materializado con columna explorer", mat2?.archetype === "EXPLORER" && Math.abs((mat2?.explorer ?? -1) - 90) < 0.5, `explorer=${mat2?.explorer}`);

  // --- 7. Remote Config (fase 2): el techo se recalibra sin release ---
  const res7 = await guardarTechos({ techoOffroad: 30 });
  check("7a. guardarTechos aplica techoOffroad=30", res7?.guardado.techoOffroad === 30, JSON.stringify(res7?.guardado));
  p = await recalcularPerfil(u2.id);
  check("7b. explorer = 18/30 → 60 y ya domina el eje de velocidad → ALL_ROUNDER",
    p.archetype === "ALL_ROUNDER" && p.scores.explorer !== null && Math.abs(p.scores.explorer! - 60) < 0.5,
    `arch=${p.archetype} explorer=${p.scores.explorer?.toFixed(1)}`);
  const res7b = await guardarTechos({ techoOffroad: 9999, techoLlano: "x" } as never);
  check("7c. claves fuera de rango/tipo rechazadas → null", res7b === null, JSON.stringify(res7b));
  await guardarTechos({ techoOffroad: 20 }); // restaura el default del spec
  p = await recalcularPerfil(u2.id);
  check("7d. techo restaurado → EXPLORER de nuevo", p.archetype === "EXPLORER", p.archetype);

  await db.user.delete({ where: { id: u2.id } });
  console.log(fallos === 0 ? "\nTODO OK" : `\nFALLOS: ${fallos}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
