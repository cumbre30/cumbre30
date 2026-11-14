export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.



import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde el APK (sync con Bearer).
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const rides = await db.ride.findMany({ where: { userId: me.id }, orderBy: { dateISO: "desc" }, take: 100 });
  return NextResponse.json({ rides }, { headers: cors });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
    const me = await getSessionUser(req);
    if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
    try {
      const b = (await req.json()) as Record<string, unknown>;
      const dateISO = new Date(typeof b.dateISO === "string" ? b.dateISO : Date.now());
      if (isNaN(dateISO.getTime())) return NextResponse.json({ error: "Fecha inválida." }, { status: 400, headers: cors });

      // Idempotente por clientId: un reintento de sync tras un corte de
      // red no debe duplicar el ride (duplicaría los km del usuario).
      const clientId = typeof b.id === "string" ? b.id.slice(0, 64) : null;
      if (clientId) {
        const existing = await db.ride.findFirst({ where: { userId: me.id, clientId }, select: { id: true } });
        if (existing) return NextResponse.json({ ok: true, id: existing.id, dedup: true }, { headers: cors });
      }

      const ride = await db.ride.create({
      data: {
        userId: me.id,
        dateISO,
        source: b.source === "gps" ? "gps" : "sim",
        distanceKm: num(b.distanceKm, 0, 500),
        maxKmh: num(b.maxKmh, 0, 150),
        maxInParkKmh: b.maxInParkKmh == null ? null : num(b.maxInParkKmh, 0, 150),
        inParkKm: b.inParkKm == null ? null : num(b.inParkKm, 0, 500),
        // Viaje registrado en vehículo motorizado (confirmado en el
        // dispositivo): no cuenta para desafíos ni estadísticas.
        motorized: b.motorized === true,
        // id local del ride para poder corregir el flag desde el cliente.
        clientId,
        avgKmh: num(b.avgKmh, 0, 100),
        elapsedSec: num(b.elapsedSec, 0, 24 * 3600),
        gainM: num(b.gainM, -1000, 5000),
        overLimitSec: num(b.overLimitSec, 0, 24 * 3600),
      },
    });
    return NextResponse.json({ ok: true, id: ride.id }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No pudimos guardar el ride." }, { status: 500, headers: cors });
  }
}

function num(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Corrige el flag de vehículo ("en realidad fui en bici") por clientId. */
export async function PATCH(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const clientId = typeof b.clientId === "string" ? b.clientId.slice(0, 64) : "";
    if (!clientId) return NextResponse.json({ error: "Falta clientId." }, { status: 400, headers: cors });
    const result = await db.ride.updateMany({
      where: { clientId, userId: me.id },
      data: { motorized: b.motorized === true },
    });
    if (result.count === 0) return NextResponse.json({ error: "Ride no encontrado." }, { status: 404, headers: cors });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "No pudimos actualizar el ride." }, { status: 500, headers: cors });
  }
}
