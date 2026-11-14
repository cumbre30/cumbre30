export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

// Enlaces públicos de ride (Ola 3):
//   POST /api/rides/share {clientId | rideId}  (con sesión) → { url }
//   GET  /api/rides/share?code=XXXXXXXX        (público)   → stats
// Solo estadísticas: el trazado GPS del ride nunca sale del
// dispositivo del dueño (privacidad).

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { VERIFICAR_ORIGEN } from "@/lib/constancia";

// Alfabeto sin I,L,O,0,1: los códigos se leen y dictan sin confundir.
const CODE_ALF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function nuevoCodigo(): string {
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALF[b[i] % CODE_ALF.length];
  return s;
}

function esTablaAusente(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? "");
  return msg.includes("does not exist") || msg.includes("P2021") || msg.includes("P2022");
}

/** Creación idempotente de la tabla (mismo patrón que Constancia):
 *  el primer intento tras el deploy se autorrepara. */
async function asegurarTabla(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "RideShare" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "code" TEXT NOT NULL,
       "rideId" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "RideShare_code_key" ON "RideShare"("code")`
  );
}

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const body = (await req.json().catch(() => null)) as { clientId?: string; rideId?: string } | null;
  if (!body?.clientId && !body?.rideId) {
    return NextResponse.json({ error: "Falta el viaje" }, { status: 400, headers: cors });
  }
  const ride = await db.ride.findFirst({
    where: {
      userId: me.id,
      ...(body.rideId ? { id: body.rideId } : { clientId: body.clientId ?? undefined }),
    },
    select: { id: true },
  });
  if (!ride) {
    return NextResponse.json(
      { error: "Ese viaje no está sincronizado en el servidor: inicia sesión y espera el sync." },
      { status: 404, headers: cors }
    );
  }
  try {
    await asegurarTabla();
    const existente = await db.rideShare.findFirst({
      where: { rideId: ride.id },
      select: { code: true },
    });
    if (existente) {
      return NextResponse.json(
        { ok: true, url: `${VERIFICAR_ORIGEN}/compartir?c=${existente.code}` },
        { headers: cors }
      );
    }
    // Colisión improbable: hasta 5 intentos de código único.
    let code: string | null = null;
    for (let i = 0; i < 5 && !code; i++) {
      try {
        const c = nuevoCodigo();
        await db.rideShare.create({ data: { code: c, rideId: ride.id } });
        code = c;
      } catch (e) {
        if (esTablaAusente(e)) throw e;
        if (!String((e as Error)?.message).includes("Unique")) throw e;
      }
    }
    if (!code) throw new Error("No se pudo generar el código");
    return NextResponse.json({ ok: true, url: `${VERIFICAR_ORIGEN}/compartir?c=${code}` }, { headers: cors });
  } catch (e) {
    if (esTablaAusente(e)) {
      // Tabla ausente y el DDL falló (sin permisos): degradación clara.
      return NextResponse.json(
        { error: "El servidor aún no tiene esta función activa." },
        { status: 503, headers: cors }
      );
    }
    return NextResponse.json({ error: "No se pudo crear el enlace" }, { status: 500, headers: cors });
  }
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const code = (new URL(req.url).searchParams.get("code") ?? "").toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400, headers: cors });
  }
  try {
    await asegurarTabla();
    const share = await db.rideShare.findUnique({ where: { code }, select: { rideId: true } });
    if (!share) return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404, headers: cors });
    const ride = await db.ride.findUnique({ where: { id: share.rideId } });
    if (!ride) return NextResponse.json({ error: "Viaje eliminado" }, { status: 404, headers: cors });
    const owner = await db.user.findUnique({
      where: { id: ride.userId },
      select: { username: true, selectedPin: true },
    });
    return NextResponse.json(
      {
        ride: {
          dateISO: ride.dateISO,
          distanceKm: ride.distanceKm,
          maxKmh: ride.maxKmh,
          maxInParkKmh: ride.maxInParkKmh,
          avgKmh: ride.avgKmh,
          elapsedSec: ride.elapsedSec,
          gainM: ride.gainM,
          inParkKm: ride.inParkKm,
          motorized: ride.motorized,
        },
        user: { username: owner?.username ?? "ciclista", selectedPin: owner?.selectedPin ?? null },
      },
      { headers: cors }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo leer el enlace" }, { status: 500, headers: cors });
  }
}
