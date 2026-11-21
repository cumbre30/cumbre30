export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Novedades del muro en rutas guardadas (propuesta Pro, Grupo D):
// experiencias nuevas (createdAt > desde) en las rutas que el
// usuario tiene como favoritas, excluyendo las propias. Beneficio
// Pro: sin compra registrada responde permitido:false sin revelar
// nada. `desde` se acota a los últimos 30 días (la etiqueta del
// muro es el diario de a bordo, no un archivo).
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { esProServer } from "@/lib/proLicenseServer";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

const LIMITE_DIAS = 30;

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const pro = await esProServer(me.email);
  if (!pro) return NextResponse.json({ permitido: false, total: 0, items: [] }, { headers: cors });

  let desde = new Date(Date.now() - LIMITE_DIAS * 86_400_000);
  try {
    const p = new URL(req.url).searchParams.get("desde");
    if (p) {
      const d = new Date(p);
      if (!Number.isNaN(d.getTime())) desde = d;
    }
    if (Date.now() - desde.getTime() > LIMITE_DIAS * 86_400_000) desde = new Date(Date.now() - LIMITE_DIAS * 86_400_000);
  } catch {
    // sin parámetro válido: último día de ventana
  }

  try {
    const favoritas = await db.routeFavorite.findMany({
      where: { userId: me.id, route: { status: "publicado", removedAt: null } },
      select: { routeId: true },
    });
    const ids = favoritas.map((f) => f.routeId);
    if (ids.length === 0) return NextResponse.json({ permitido: true, total: 0, items: [] }, { headers: cors });

    const where = {
      removedAt: null,
      userId: { not: me.id },
      createdAt: { gt: desde },
      routeId: { in: ids },
    };
    const [total, items] = await Promise.all([
      db.routeExperience.count({ where }),
      db.routeExperience.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          fechaRealizacion: true,
          user: { select: { username: true } },
          route: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    return NextResponse.json(
      {
        permitido: true,
        total,
        items: items.map((i) => ({
          id: i.id,
          createdAt: i.createdAt,
          fechaRealizacion: i.fechaRealizacion,
          username: i.user.username,
          ruta: i.route,
        })),
      },
      { headers: cors }
    );
  } catch (e) {
    console.error("[experiences.nuevas]", e);
    return NextResponse.json({ error: "No se pudieron consultar las novedades." }, { status: 500, headers: cors });
  }
}
