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
    if (esTablaAusente(e)) return NextResponse.json({ registered: false });
    return NextResponse.json({ error: "No pudimos consultar el registro." }, { status: 500 });
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
    const created = await db.constancia.upsert({
      where: { id: hash },
      create: { id: hash, rideId, payload: payload as object },
      update: {},
    });
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
