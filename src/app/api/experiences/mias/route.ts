export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Mis experiencias (propuesta Pro 2026-11-21): histórico propio
// para el panel «Mi aporte» de Explorar y la exportación legible.
// Solo del dueño de la sesión; sin fotos (peso) — para verlas está
// el muro y la ficha. rutasCubiertas = rutas distintas con al menos
// una experiencia propia viva.
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
    const [exps, total, porRuta] = await Promise.all([
      db.routeExperience.findMany({
        where: { userId: me.id, removedAt: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          fechaRealizacion: true,
          comentario: true,
          condiciones: true,
          createdAt: true,
          route: { select: { id: true, nombre: true, distKm: true, estadoVigencia: true } },
        },
      }),
      db.routeExperience.count({ where: { userId: me.id, removedAt: null } }),
      db.routeExperience.groupBy({ by: ["routeId"], where: { userId: me.id, removedAt: null } }),
    ]);

    return NextResponse.json(
      {
        experiencias: exps.map((e) => ({
          id: e.id,
          fechaRealizacion: e.fechaRealizacion,
          comentario: e.comentario,
          condiciones: e.condiciones,
          createdAt: e.createdAt,
          ruta: e.route,
        })),
        total,
        rutasCubiertas: porRuta.length,
      },
      { headers: cors }
    );
  } catch (e) {
    console.error("[experiences.mias]", e);
    return NextResponse.json({ error: "No se pudo cargar tu historial." }, { status: 500, headers: cors });
  }
}
