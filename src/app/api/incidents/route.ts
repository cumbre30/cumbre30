export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isIncidentType } from "@/lib/incidents";

const EDAD_EXPIRA_MS = 30 * 86_400_000; // 30 días sin confirmaciones
const RESUELTOS_CIERRAN = 3; // 3 votos "ya resuelto" cierran el reporte
const REPORTES_CIERRAN = 2; // 2 reportes de abuso ocultan la incidencia (UGC Play)

/** ¿Falta una columna (db push pendiente en la base en línea)? */
function esColumnaAusente(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? "");
  return msg.includes("P2022") || /column.*does not exist/i.test(msg);
}

/** Columnas de moderación comunitaria (Ola 1): creación idempotente
 *  espejando schema.prisma. La base en línea puede quedarse atrás del
 *  código; con esto el primer intento tras el deploy se autorrepara.
 *  Prisma crea INTEGER NOT NULL DEFAULT 0 y TIMESTAMP(3) NULL.
 *  v1.13.14: reportCount - denuncias de abuso (política UGC de Play). */
async function asegurarColumnas(): Promise<void> {
  await db.$executeRawUnsafe(
    `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "confirmCount" INTEGER NOT NULL DEFAULT 0`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "resolvedCount" INTEGER NOT NULL DEFAULT 0`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "lastConfirmAt" TIMESTAMP(3)`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "reportCount" INTEGER NOT NULL DEFAULT 0`
  );
}

/** Expiración automática: 30 días sin ninguna confirmación → inactivo.
 *  La comunidad confirma frescura; el decaimiento hace el resto.
 *  v1.13.14: también cierra incidencias con 2+ denuncias (autorreparo
 *  por si el PUT que cerró no alcanzó a completarse). */
async function expirarViejas(): Promise<void> {
  await db.incident.updateMany({
    where: {
      active: true,
      confirmCount: 0,
      resolvedCount: 0,
      createdAt: { lt: new Date(Date.now() - EDAD_EXPIRA_MS) },
    },
    data: { active: false },
  });
  await db.incident.updateMany({
    where: { active: true, reportCount: { gte: REPORTES_CIERRAN } },
    data: { active: false },
  });
}

/** Fila completa de una incidencia para el feed (formato del cliente). */
function aFeed(
  i: { id: string; type: string; lat: number; lon: number; note: string | null; createdAt: Date; confirmCount: number; resolvedCount: number; lastConfirmAt: Date | null },
  username: string,
  authorPin: string,
  mine: boolean
) {
  return {
    id: i.id,
    type: i.type,
    lat: i.lat,
    lon: i.lon,
    note: i.note,
    createdAt: i.createdAt.toISOString(),
    confirmCount: i.confirmCount,
    resolvedCount: i.resolvedCount,
    lastConfirmAt: i.lastConfirmAt ? i.lastConfirmAt.toISOString() : null,
    username,
    authorPin,
    mine,
  };
}

export async function GET() {
  try {
    await expirarViejas();
    const incidents = await db.incident.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { username: true, selectedPin: true } } },
    });
    return NextResponse.json({
      incidents: incidents.map((i) => aFeed(i, i.user.username, i.user.selectedPin, false)),
    });
  } catch (e) {
    if (esColumnaAusente(e)) {
      // Autorreparo: añadir columnas de moderación y volver a intentar.
      try {
        await asegurarColumnas();
        await expirarViejas();
        const incidents = await db.incident.findMany({
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 300,
          include: { user: { select: { username: true, selectedPin: true } } },
        });
        return NextResponse.json({
          incidents: incidents.map((i) => aFeed(i, i.user.username, i.user.selectedPin, false)),
        });
      } catch {
        return NextResponse.json({ incidents: [] });
      }
    }
    return NextResponse.json({ incidents: [] });
  }
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Inicia sesión para reportar incidencias." }, { status: 401 });
  try {
    const b = (await req.json()) as { type?: string; lat?: number; lon?: number; note?: string };
    const type = b.type ?? "";
    if (!isIncidentType(type)) return NextResponse.json({ error: "Tipo de incidencia no válido." }, { status: 400 });
    const lat = Number(b.lat);
    const lon = Number(b.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "Ubicación no válida." }, { status: 400 });
    }
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null;

    const before = await db.incident.count({ where: { userId: me.id } });
    const inc = await db.incident.create({ data: { userId: me.id, type, lat, lon, note } });
    if (before === 0) {
      await db.achievement.upsert({
        where: { userId_code: { userId: me.id, code: "reportero" } },
        create: { userId: me.id, code: "reportero" },
        update: {},
      });
    }
    return NextResponse.json({
      ok: true,
      incident: aFeed(inc, me.username, me.selectedPin, true),
    });
  } catch (e) {
    if (esColumnaAusente(e)) {
      try {
        await asegurarColumnas();
        return NextResponse.json({ error: "Reintenta el reporte." }, { status: 503 });
      } catch {
        return NextResponse.json({ error: "No pudimos registrar la incidencia." }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "No pudimos registrar la incidencia." }, { status: 500 });
  }
}

/** Voto de moderación: { id, vote: "confirm" | "resolved" | "report" }.
 *  "confirm" sube la frescura; "resolved" acumula y con 3 cierra el
 *  reporte (soft-delete); "report" (v1.13.14, política UGC de Play)
 *  denuncia contenido inapropiado y con 2 cierra la incidencia.
 *  Requiere sesión (anti-spam básico); en el APK sin sesión el voto
 *  vive local y se refleja en el feed. */
export async function PUT(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Inicia sesión para moderar." }, { status: 401 });
  try {
    const b = (await req.json()) as { id?: string; vote?: string };
    const id = b.id ?? "";
    if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
    const vote = b.vote === "confirm" || b.vote === "resolved" || b.vote === "report" ? b.vote : "";
    if (!vote) return NextResponse.json({ error: "Voto no válido." }, { status: 400 });

    const inc = await db.incident.findUnique({ where: { id } });
    if (!inc || !inc.active) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
    // El autor no denuncia su propia incidencia: la elimina directamente.
    if (vote === "report" && inc.userId === me.id) {
      return NextResponse.json({ error: "Es tu propia incidencia; puedes eliminarla." }, { status: 400 });
    }

    const data =
      vote === "confirm"
        ? { confirmCount: { increment: 1 }, lastConfirmAt: new Date() }
        : vote === "resolved"
          ? { resolvedCount: { increment: 1 } }
          : { reportCount: { increment: 1 } };
    const upd = await db.incident.update({ where: { id }, data });
    const cierra = vote === "resolved" ? upd.resolvedCount >= RESUELTOS_CIERRAN : vote === "report" ? upd.reportCount >= REPORTES_CIERRAN : false;
    if (cierra) {
      await db.incident.update({ where: { id }, data: { active: false } });
    }
    return NextResponse.json({
      ok: true,
      confirmCount: upd.confirmCount,
      resolvedCount: upd.resolvedCount,
      cerrada: cierra,
    });
  } catch (e) {
    if (esColumnaAusente(e)) {
      try {
        await asegurarColumnas();
        return NextResponse.json({ error: "Reintenta el voto." }, { status: 503 });
      } catch {
        return NextResponse.json({ error: "No pudimos registrar el voto." }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "No pudimos registrar el voto." }, { status: 500 });
  }
}

/** Elimina (soft-delete) una incidencia propia: ?id=... */
export async function DELETE(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const inc = await db.incident.findUnique({ where: { id } });
  if (!inc || inc.userId !== me.id) return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  await db.incident.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
