export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.



import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { validateUsername, usernameLocked } from "@/lib/username";
import { isPinId, type PinId } from "@/lib/pins";
import { ACHIEVEMENT_BY_CODE, normalizeCodes, statsFromRides } from "@/lib/pins";

/** Pines desbloqueados: el clásico + las recompensas de logros obtenidos. */
export async function unlockedPins(userId: string): Promise<PinId[]> {
  const rows = await db.achievement.findMany({ where: { userId }, select: { code: true } });
  const set = new Set<PinId>(["clasico"]);
  for (const code of normalizeCodes(rows.map((r) => r.code))) {
    const def = ACHIEVEMENT_BY_CODE[code];
    if (def) set.add(def.reward);
  }
  return [...set];
}

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  // Estadísticas: solo viajes con GPS real. Los de demostración
  // (simulación, sin GPS) no cuentan en ningún total.
  const [rides, achievements, friendships] = await Promise.all([
    db.ride.findMany({ where: { userId: me.id, source: "gps" }, orderBy: { dateISO: "desc" }, take: 200 }),
    db.achievement.findMany({ where: { userId: me.id }, orderBy: { unlockedAt: "asc" } }),
    db.friendship.findMany({ where: { userId: me.id }, include: { friend: true } }),
  ]);

  const incidentCount = await db.incident.count({ where: { userId: me.id } });
  const stats = statsFromRides(
    rides.map((r) => ({
      distanceKm: r.distanceKm,
      maxKmh: r.maxKmh,
      maxInParkKmh: r.maxInParkKmh,
      inParkKm: r.inParkKm,
      gainM: r.gainM,
      overLimitSec: r.overLimitSec,
      elapsedSec: r.elapsedSec,
      dateISO: r.dateISO,
    })),
    incidentCount
  );

  const friends = await Promise.all(
    friendships.map(async (f) => {
      const [agg, lastRide] = await Promise.all([
        db.ride.aggregate({
          where: { userId: f.friendId, source: "gps" },
          _sum: { distanceKm: true, gainM: true },
          _max: { maxKmh: true },
          _count: true,
        }),
        db.ride.findFirst({ where: { userId: f.friendId, source: "gps" }, orderBy: { dateISO: "desc" }, select: { dateISO: true } }),
      ]);
      return {
        username: f.friend.username,
        selectedPin: f.friend.selectedPin,
        totalKm: Number((agg._sum.distanceKm ?? 0).toFixed(1)),
        totalGainM: Math.round(agg._sum.gainM ?? 0),
        maxKmh: Number((agg._max.maxKmh ?? 0).toFixed(1)),
        rideCount: agg._count,
        lastRideDate: lastRide?.dateISO.toISOString() ?? null,
      };
    })
  );

  return NextResponse.json({
    user: me,
    stats: {
      totalKm: Number(stats.totalKm.toFixed(1)),
      rideCount: stats.rideCount,
      maxKmh: Number(stats.maxKmh.toFixed(1)),
      totalGainM: Math.round(stats.totalGainM),
      parkRides: stats.parkRides,
      cleanParkRides: stats.cleanParkRides,
      nightRides: stats.nightRides,
      dawnRides: stats.dawnRides,
      maxRideKm: Number(stats.maxRideKm.toFixed(1)),
      weekendRides: stats.weekendRides,
      totalHours: Number(stats.totalHours.toFixed(1)),
      lastRideDate: rides[0]?.dateISO.toISOString() ?? null,
      incidentCount,
    },
    achievements: achievements.map((a) => ({ code: a.code, unlockedAt: a.unlockedAt.toISOString() })),
    pins: await unlockedPins(me.id),
    friends: friends.sort((a, b) => a.username.localeCompare(b.username)),
  });
}

export async function PUT(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, string | Date | null> = {};

  // Datos de la bicicleta (campo presente → actualizar; "" → limpiar)
  for (const k of ["bikeBrand", "bikeType", "bikeModel", "bikeSize", "bikeColor"] as const) {
    if (k in body) {
      const s = typeof body[k] === "string" ? (body[k] as string).trim().slice(0, 40) : "";
      data[k] = s.length ? s : null;
    }
  }

  // Nombre de usuario: se puede cambiar solo 1 vez cada 30 días. Las
  // estadísticas, logros y pines quedan asociados al correo (la clave de
  // la cuenta es el id), así que el cambio no afecta ningún dato.
  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase();
    const formatErr = validateUsername(username);
    if (formatErr) return NextResponse.json({ error: formatErr }, { status: 400 });
    if (username !== me.username) {
      const { locked, nextAt } = usernameLocked(me.usernameChangedAt);
      if (locked && nextAt) {
        return NextResponse.json(
          { error: `Ya cambiaste tu usuario recientemente. Podrás cambiarlo de nuevo el ${nextAt.toLocaleDateString("es-CL")}.` },
          { status: 400 }
        );
      }
      const dup = await db.user.findUnique({ where: { username }, select: { id: true } });
      if (dup && dup.id !== me.id) {
        return NextResponse.json({ error: "Ese usuario ya está en uso por otra cuenta." }, { status: 409 });
      }
      data.username = username;
      data.usernameChangedAt = new Date();
    }
  }

  // Pin activo (solo si es un id válido; el desbloqueo se valida al listar)
  if (typeof body.selectedPin === "string" && isPinId(body.selectedPin)) {
    data.selectedPin = body.selectedPin;
  }

  const user = await db.user.update({ where: { id: me.id }, data, select: { selectedPin: true } });
  return NextResponse.json({ ok: true, selectedPin: user.selectedPin });
}
