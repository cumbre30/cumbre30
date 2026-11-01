import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const rows = await db.friendship.findMany({
    where: { userId: me.id },
    include: { friend: { select: { id: true, username: true, selectedPin: true } } },
  });

  const friends = await Promise.all(
    rows.map(async (f) => {
      const [agg, lastRide, achCount] = await Promise.all([
        db.ride.aggregate({
          where: { userId: f.friendId },
          _sum: { distanceKm: true, gainM: true },
          _max: { maxKmh: true },
          _count: true,
        }),
        db.ride.findFirst({ where: { userId: f.friendId }, orderBy: { dateISO: "desc" }, select: { dateISO: true } }),
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

  return NextResponse.json({ friends: friends.sort((a, b) => a.username.localeCompare(b.username)) });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Inicia sesión para agregar amigos." }, { status: 401 });
  const body = (await req.json()) as { username?: string };
  const username = (body.username ?? "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "Escribe el usuario de tu amigo." }, { status: 400 });
  if (username === me.username) return NextResponse.json({ error: "No puedes agregarte a ti mismo." }, { status: 400 });

  const friend = await db.user.findUnique({ where: { username } });
  if (!friend) return NextResponse.json({ error: `No existe el usuario "${username}".` }, { status: 404 });

  const existing = await db.friendship.findFirst({
    where: { OR: [{ userId: me.id, friendId: friend.id }, { userId: friend.id, friendId: me.id }] },
  });
  if (existing) return NextResponse.json({ error: "Ya son amigos." }, { status: 409 });

  await db.$transaction([
    db.friendship.create({ data: { userId: me.id, friendId: friend.id } }),
    db.friendship.create({ data: { userId: friend.id, friendId: me.id } }),
  ]);
  return NextResponse.json({ ok: true, username });
}

/** Elimina amistad (bidireccional): ?username=... */
export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const username = (new URL(req.url).searchParams.get("username") ?? "").toLowerCase();
  const friend = await db.user.findUnique({ where: { username } });
  if (!friend) return NextResponse.json({ error: "Amigo no encontrado." }, { status: 404 });
  await db.friendship.deleteMany({
    where: { OR: [{ userId: me.id, friendId: friend.id }, { userId: friend.id, friendId: me.id }] },
  });
  return NextResponse.json({ ok: true });
}
