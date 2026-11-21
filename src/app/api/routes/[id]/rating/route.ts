export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Valoración de ruta (fase E): 1-5, upsert por [userId, routeId]
// (actualizable — no ranking: la nota es de experiencia, v2.1 §5.3
// «comodidad», nunca ordena el catálogo por rendimiento).
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
  const limited = guard(req, "routes.rating", me.id, 30, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const b = (await req.json()) as { valor?: unknown };
    const valor = typeof b.valor === "number" && Number.isInteger(b.valor) && b.valor >= 1 && b.valor <= 5 ? b.valor : null;
    if (valor === null) return NextResponse.json({ error: "La valoración debe ser un entero 1-5." }, { status: 400, headers: cors });
    const ruta = await db.route.findFirst({ where: { id, removedAt: null, status: "publicado" }, select: { id: true } });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    await db.routeRating.upsert({
      where: { userId_routeId: { userId: me.id, routeId: id } },
      update: { valor },
      create: { userId: me.id, routeId: id, valor },
    });
    const agg = await db.routeRating.aggregate({ where: { routeId: id }, _avg: { valor: true }, _count: true });
    return NextResponse.json({
      ok: true, valor,
      promedio: agg._avg.valor ? Math.round(agg._avg.valor * 10) / 10 : null,
      votos: agg._count,
    }, { headers: cors });
  } catch (e) {
    console.error("[routes.rating]", e);
    return NextResponse.json({ error: "No pudimos guardar la valoración." }, { status: 500, headers: cors });
  }
}
