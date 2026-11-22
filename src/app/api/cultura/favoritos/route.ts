export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.


import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

/** Favoritos de Cultura Ciclista del usuario con sesión. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const rows = await db.culturaFavorito.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    include: { recurso: true },
  });

  return NextResponse.json(
    { favoritos: rows.map((f) => f.recurso) },
    { headers: cors },
  );
}

/** Agregar a favoritos: { recursoId }. Idempotente (único por usuario). */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const limitado = guard(req, "cultura-fav", me.id, 60, 60_000, cors);
  if (limitado) return limitado;

  const body = (await req.json().catch(() => ({}))) as { recursoId?: string };
  const recursoId = body.recursoId ?? "";
  if (!recursoId) {
    return NextResponse.json({ error: "Falta recursoId" }, { status: 400, headers: cors });
  }
  const recurso = await db.culturaRecurso.findUnique({ where: { id: recursoId } });
  if (!recurso || !recurso.publicado) {
    return NextResponse.json({ error: "Recurso no disponible" }, { status: 404, headers: cors });
  }

  await db.culturaFavorito.upsert({
    where: { userId_recursoId: { userId: me.id, recursoId } },
    create: { userId: me.id, recursoId },
    update: {},
  });
  return NextResponse.json({ ok: true, guardado: true }, { headers: cors });
}

/** Quitar de favoritos: ?recursoId=. Idempotente. */
export async function DELETE(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const recursoId = new URL(req.url).searchParams.get("recursoId") ?? "";
  if (!recursoId) {
    return NextResponse.json({ error: "Falta recursoId" }, { status: 400, headers: cors });
  }
  await db.culturaFavorito.deleteMany({ where: { userId: me.id, recursoId } });
  return NextResponse.json({ ok: true, guardado: false }, { headers: cors });
}
