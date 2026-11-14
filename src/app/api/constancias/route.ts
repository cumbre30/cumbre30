export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const HASH_RE = /^[0-9a-f]{64}$/;

/** ¿Falta la tabla (db push pendiente)? → degradación elegante: la
 *  verificación responde "sin registro" en vez de romper la página. */
function esTablaAusente(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? "");
  return msg.includes("does not exist") || msg.includes("P2021") || msg.includes("P2022");
}

/** Creación idempotente de la tabla, espejando el modelo Prisma
 *  (schema.prisma). La base en línea puede quedarse atrás del código
 *  (deploy previo a `prisma db push`); con esto el primer intento tras
 *  el deploy se autorrepara en vez de responder 503 para siempre.
 *  `CREATE TABLE IF NOT EXISTS` hace que las llamadas concurrentes sean
 *  seguras y que un `prisma db push` posterior no encuentre diff. */
async function asegurarTabla(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "Constancia" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "rideId" TEXT NOT NULL,
       "payload" JSONB NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Constancia_rideId_idx" ON "Constancia"("rideId")`
  );
}

/** GET /api/constancias?hash=<sha256> → ¿está registrada en línea? */
export async function GET(req: Request) {
  const hash = (new URL(req.url).searchParams.get("hash") ?? "").toLowerCase();
  if (!HASH_RE.test(hash)) {
    return NextResponse.json({ error: "Hash no válido." }, { status: 400 });
  }
  try {
    const c = await db.constancia.findUnique({ where: { id: hash } });
    if (!c) return NextResponse.json({ registered: false });
    return NextResponse.json({
      registered: true,
      createdAt: c.createdAt.toISOString(),
      rideId: c.rideId,
      payload: c.payload,
    });
  } catch (e) {
    if (!esTablaAusente(e)) {
      return NextResponse.json({ error: "No pudimos consultar el registro." }, { status: 500 });
    }
    // Autorreparo: crear la tabla y volver a consultar una sola vez.
    try {
      await asegurarTabla();
      const c = await db.constancia.findUnique({ where: { id: hash } });
      if (!c) return NextResponse.json({ registered: false });
      return NextResponse.json({
        registered: true,
        createdAt: c.createdAt.toISOString(),
        rideId: c.rideId,
        payload: c.payload,
      });
    } catch {
      return NextResponse.json({ registered: false });
    }
  }
}

/** POST /api/constancias { hash, rideId, payload } → registra (idempotente). */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { hash?: string; rideId?: string; payload?: unknown };
    const hash = (b.hash ?? "").toLowerCase();
    if (!HASH_RE.test(hash)) {
      return NextResponse.json({ error: "Hash no válido." }, { status: 400 });
    }
    const rideId = typeof b.rideId === "string" ? b.rideId.slice(0, 64) : "";
    if (!rideId) return NextResponse.json({ error: "Falta rideId." }, { status: 400 });
    const payload = b.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Payload no válido." }, { status: 400 });
    }
    if (JSON.stringify(payload).length > 4096) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 400 });
    }
    // Upsert idempotente: re-emitir la misma constancia conserva la
    // fecha del PRIMER registro (el día real de la emisión).
    const crear = () =>
      db.constancia.upsert({
        where: { id: hash },
        create: { id: hash, rideId, payload: payload as object },
        update: {},
      });
    let created;
    try {
      created = await crear();
    } catch (e) {
      if (!esTablaAusente(e)) {
        return NextResponse.json({ error: "No pudimos registrar la constancia." }, { status: 500 });
      }
      // Autorreparo: crear la tabla y reintentar una sola vez.
      try {
        await asegurarTabla();
        created = await crear();
      } catch {
        return NextResponse.json({ ok: false, error: "Registro en línea no disponible." }, { status: 503 });
      }
    }
    return NextResponse.json({
      ok: true,
      payloadOk: true,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    if (esTablaAusente(e)) {
      // Tabla pendiente de crear (npx prisma db push): la emisión del
      // PDF sigue funcionando y el QR queda válido por integridad.
      return NextResponse.json({ ok: false, error: "Registro en línea no disponible." }, { status: 503 });
    }
    return NextResponse.json({ error: "No pudimos registrar la constancia." }, { status: 500 });
  }
}
