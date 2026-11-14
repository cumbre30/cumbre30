export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.


import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde el APK (amigos con Bearer).
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const rows = await db.friendship.findMany({
    where: { userId: me.id },
    include: { friend: { select: { id: true, username: true, selectedPin: true } } },
  });

  const friends = await Promise.all(
    rows.map(async (f) => {
      const [agg, lastRide, achCount] = await Promise.all([
        db.ride.aggregate({
          where: { userId: f.friendId, motorized: false },
          _sum: { distanceKm: true, gainM: true },
          _max: { maxKmh: true },
          _count: true,
        }),
        db.ride.findFirst({ where: { userId: f.friendId, motorized: false }, orderBy: { dateISO: "desc" }, select: { dateISO: true } }),
        db.achievement.count({ where: { userId: f.friendId } }),
      ]);
      return {
        username: f.friend.username,
        selectedPin: f.friend.selectedPin,
        totalKm: Number((agg._sum.distanceKm ?? 0).toFixed(1)),
        totalGainM: Math.round(agg._sum.gainM ?? 0),
        maxKmh: Number((agg._max.maxKmh ?? 0).toFixed(1)),
        rideCount: agg._count,
        achievementCount: achCount,
        lastRideDate: lastRide?.dateISO.toISOString() ?? null,
      };
    })
  );

  return NextResponse.json(
    { friends: friends.sort((a, b) => a.username.localeCompare(b.username)) },
    { headers: cors }
  );
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) {
    return NextResponse.json(
      { error: "Inicia sesión para agregar amigos." },
      { status: 401, headers: cors }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { username?: string };
  const username = (body.username ?? "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "Escribe el usuario de tu amigo." }, { status: 400, headers: cors });
  if (username === me.username) return NextResponse.json({ error: "No puedes agregarte a ti mismo." }, { status: 400, headers: cors });

  const friend = await db.user.findUnique({ where: { username } });
  if (!friend) return NextResponse.json({ error: `No existe el usuario "${username}".` }, { status: 404, headers: cors });

  const existing = await db.friendship.findFirst({
    where: { OR: [{ userId: me.id, friendId: friend.id }, { userId: friend.id, friendId: me.id }] },
  });
  if (existing) return NextResponse.json({ error: "Ya son amigos." }, { status: 409, headers: cors });

  await db.$transaction([
    db.friendship.create({ data: { userId: me.id, friendId: friend.id } }),
    db.friendship.create({ data: { userId: friend.id, friendId: me.id } }),
  ]);
  return NextResponse.json({ ok: true, username }, { headers: cors });
}

/** Elimina amistad (bidireccional): ?username=... */
export async function DELETE(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const username = (new URL(req.url).searchParams.get("username") ?? "").toLowerCase();
  const friend = await db.user.findUnique({ where: { username } });
  if (!friend) return NextResponse.json({ error: "Amigo no encontrado." }, { status: 404, headers: cors });
  await db.friendship.deleteMany({
    where: { OR: [{ userId: me.id, friendId: friend.id }, { userId: friend.id, friendId: me.id }] },
  });
  return NextResponse.json({ ok: true }, { headers: cors });
}
