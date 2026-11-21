export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Mis rutas favoritas (fase E): lista del servidor para el tab
// «Favoritas» de la biblioteca. Solo rutas publicadas y vigentes
// en el catálogo (removedAt null).
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  try {
    const favs = await db.routeFavorite.findMany({
      where: { userId: me.id, route: { removedAt: null, status: "publicado" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        routeId: true, createdAt: true,
        route: {
          select: {
            id: true, nombre: true, modalidad: true, distKm: true, gainM: true,
            dificultadFisica: true, estadoVigencia: true,
            owner: { select: { username: true } },
          },
        },
      },
    });
    return NextResponse.json({
      favoritas: favs.map((f) => ({ ...f.route, favoritadoAt: f.createdAt, creador: f.route.owner?.username ?? "" })),
    }, { headers: cors });
  } catch (e) {
    console.error("[routes.favorites]", e);
    return NextResponse.json({ error: "No pudimos listar tus favoritas." }, { status: 500, headers: cors });
  }
}
