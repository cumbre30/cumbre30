export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Favorito de ruta (fase E): toggle idempotente por [userId,
// routeId] (@@unique). Sin sesión → 401; rate limit honesto.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.favorite", me.id, 60, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const ruta = await db.route.findFirst({ where: { id, removedAt: null, status: "publicado" }, select: { id: true } });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    const existente = await db.routeFavorite.findUnique({
      where: { userId_routeId: { userId: me.id, routeId: id } },
    });
    if (existente) {
      await db.routeFavorite.delete({ where: { id: existente.id } });
      return NextResponse.json({ ok: true, favorito: false }, { headers: cors });
    }
    await db.routeFavorite.create({ data: { userId: me.id, routeId: id } });
    return NextResponse.json({ ok: true, favorito: true }, { headers: cors });
  } catch (e) {
    console.error("[routes.favorite]", e);
    return NextResponse.json({ error: "No pudimos guardar el favorito." }, { status: 500, headers: cors });
  }
}
