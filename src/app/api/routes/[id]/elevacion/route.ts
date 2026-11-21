export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Recalcular elevación (fase D, v2.1 §5.1): el creador puede pedir
// el muestreo del servicio desde su ficha. Es idempotente por
// RouteVersion (la misma geometría produce el mismo resultado y NO
// crea versiones: la elevación no es geometría). Solo el dueño.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";
import { resolverElevacionDePolyline } from "@/lib/elevacionServicio";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.elevacion", me.id, 10, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const ruta = await db.route.findFirst({
      where: { id, ownerId: me.id, removedAt: null },
      select: { id: true, polyline: true, gainM: true, eleFuente: true, versions: { orderBy: { v: "desc" }, take: 1, select: { id: true, v: true } } },
    });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });

    const resuelta = await resolverElevacionDePolyline(ruta.polyline);
    if (!resuelta) {
      // Servicio caído o sin cobertura para la zona: se conserva lo
      // vigente (posiblemente null) — jamás se escribe 0 ficticio.
      return NextResponse.json({ ok: false, error: "El servicio de elevación no respondió; conserva tus datos actuales." }, { status: 502, headers: cors });
    }

    const version = ruta.versions[0] ?? null;
    await db.$transaction([
      db.route.update({
        where: { id: ruta.id },
        data: { ...resuelta, eleFuente: "servicio" },
      }),
      ...(version
        ? [db.routeVersion.update({
            where: { id: version.id },
            data: { eleSnapshot: resuelta },
          })]
        : []),
    ]);
    return NextResponse.json({ ok: true, ele: resuelta, version: version?.v ?? 1 }, { headers: cors });
  } catch (e) {
    console.error("[routes.elevacion]", e);
    return NextResponse.json({ error: "No pudimos recalcular la elevación." }, { status: 500, headers: cors });
  }
}
