import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function num(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const rides = await db.ride.findMany({ where: { userId: me.id }, orderBy: { dateISO: "desc" }, take: 100 });
  return NextResponse.json({ rides });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const dateISO = new Date(typeof b.dateISO === "string" ? b.dateISO : Date.now());
    if (isNaN(dateISO.getTime())) return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });

    const ride = await db.ride.create({
      data: {
        userId: me.id,
        dateISO,
        source: b.source === "gps" ? "gps" : "sim",
        distanceKm: num(b.distanceKm, 0, 500),
        maxKmh: num(b.maxKmh, 0, 150),
        maxInParkKmh: b.maxInParkKmh == null ? null : num(b.maxInParkKmh, 0, 150),
        avgKmh: num(b.avgKmh, 0, 100),
        elapsedSec: num(b.elapsedSec, 0, 24 * 3600),
        gainM: num(b.gainM, -1000, 5000),
        overLimitSec: num(b.overLimitSec, 0, 24 * 3600),
      },
    });
    return NextResponse.json({ ok: true, id: ride.id });
  } catch {
    return NextResponse.json({ error: "No pudimos guardar el ride." }, { status: 500 });
  }
}
