export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.



import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isIncidentType } from "@/lib/incidents";

export async function GET() {
  const incidents = await db.incident.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { username: true, selectedPin: true } } },
  });
  return NextResponse.json({
    incidents: incidents.map((i) => ({
      id: i.id,
      type: i.type,
      lat: i.lat,
      lon: i.lon,
      note: i.note,
      createdAt: i.createdAt.toISOString(),
      username: i.user.username,
      authorPin: i.user.selectedPin,
      mine: false,
    })),
  });
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
      incident: {
        id: inc.id,
        type: inc.type,
        lat: inc.lat,
        lon: inc.lon,
        note: inc.note,
        createdAt: inc.createdAt.toISOString(),
        username: me.username,
        authorPin: me.selectedPin,
        mine: true,
      },
    });
  } catch {
    return NextResponse.json({ error: "No pudimos registrar la incidencia." }, { status: 500 });
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
