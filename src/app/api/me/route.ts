import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isPinId, type PinId } from "@/lib/pins";
import { ACHIEVEMENT_BY_CODE } from "@/lib/pins";

/** Pines desbloqueados: el clásico + las recompensas de logros obtenidos. */
export async function unlockedPins(userId: string): Promise<PinId[]> {
  const rows = await db.achievement.findMany({ where: { userId }, select: { code: true } });
  const set = new Set<PinId>(["clasico"]);
  for (const r of rows) {
    const def = ACHIEVEMENT_BY_CODE[r.code];
    if (def) set.add(def.reward);
  }
  return [...set];
}

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const [rides, achievements, friendships] = await Promise.all([
    db.ride.findMany({ where: { userId: me.id }, orderBy: { dateISO: "desc" }, take: 200 }),
    db.achievement.findMany({ where: { userId: me.id }, orderBy: { unlockedAt: "asc" } }),
    db.friendship.findMany({ where: { userId: me.id }, include: { friend: true } }),
  ]);

  const totalKm = rides.reduce((a, r) => a + r.distanceKm, 0);
  const totalGainM = rides.reduce((a, r) => a + r.gainM, 0);
  const maxKmh = rides.reduce((a, r) => Math.max(a, r.maxKmh), 0);
  const incidentCount = await db.incident.count({ where: { userId: me.id } });

  const friends = await Promise.all(
    friendships.map(async (f) => {
      const [agg, lastRide] = await Promise.all([
        db.ride.aggregate({
          where: { userId: f.friendId },
          _sum: { distanceKm: true, gainM: true },
          _max: { maxKmh: true },
          _count: true,
        }),
        db.ride.findFirst({ where: { userId: f.friendId }, orderBy: { dateISO: "desc" }, select: { dateISO: true } }),
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
      totalKm: Number(totalKm.toFixed(1)),
      rideCount: rides.length,
      maxKmh: Number(maxKmh.toFixed(1)),
      totalGainM: Math.round(totalGainM),
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
  const data: Record<string, string | null> = {};

  // Datos de la bicicleta (campo presente → actualizar; "" → limpiar)
  for (const k of ["bikeBrand", "bikeType", "bikeModel", "bikeSize", "bikeColor"] as const) {
    if (k in body) {
      const s = typeof body[k] === "string" ? (body[k] as string).trim().slice(0, 40) : "";
      data[k] = s.length ? s : null;
    }
  }

  // Pin activo (solo si es un id válido; el desbloqueo se valida al listar)
  if (typeof body.selectedPin === "string" && isPinId(body.selectedPin)) {
    data.selectedPin = body.selectedPin;
  }

  const user = await db.user.update({ where: { id: me.id }, data, select: { selectedPin: true } });
  return NextResponse.json({ ok: true, selectedPin: user.selectedPin });
}
