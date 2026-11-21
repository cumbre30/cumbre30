export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Experiencias comunitarias (fase E, v2.1 §6): texto + condiciones
// tipificadas (máx 3) + fecha de realización; anclan a la RouteVersion
// vigente al escribir. Una por [usuario, ruta, fecha] (@@unique).
// JAMÁS escriben en Route ni llevan pista GPS (solo metadatos elegidos).
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";
import { CONDICIONES_VALIDAS } from "@/lib/comunidad";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.experience", me.id, 15, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const comentario = typeof b.comentario === "string" ? b.comentario.trim().slice(0, 2000) || null : null;
    const observacion = typeof b.observacion === "string" ? b.observacion.trim().slice(0, 500) || null : null;
    const fecha = typeof b.fechaRealizacion === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fechaRealizacion) ? b.fechaRealizacion : null;
    if (!fecha) return NextResponse.json({ error: "La fecha de realización es obligatoria (ISO yyyy-mm-dd)." }, { status: 400, headers: cors });
    const condicionesRaw = Array.isArray(b.condiciones) ? (b.condiciones as unknown[]) : [];
    if (condicionesRaw.length > 3) return NextResponse.json({ error: "Máximo 3 condiciones." }, { status: 400, headers: cors });
    const condiciones = condicionesRaw.filter((c): c is string => typeof c === "string" && CONDICIONES_VALIDAS.includes(c));
    if (condiciones.length !== condicionesRaw.length) return NextResponse.json({ error: "Condición inválida." }, { status: 400, headers: cors });
    const rideId = typeof b.rideId === "string" ? b.rideId.slice(0, 64) : null;

    const ruta = await db.route.findFirst({
      where: { id, removedAt: null, status: "publicado" },
      select: { id: true, versions: { orderBy: { v: "desc" }, take: 1, select: { id: true } } },
    });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    const versionId = ruta.versions[0]?.id;
    if (!versionId) return NextResponse.json({ error: "La ruta no tiene versión publicada." }, { status: 400, headers: cors });

    // Una experiencia por [usuario, ruta, fecha].
    const dup = await db.routeExperience.findUnique({
      where: { userId_routeId_fechaRealizacion: { userId: me.id, routeId: id, fechaRealizacion: fecha } },
    });
    if (dup) return NextResponse.json({ ok: true, yaRegistrada: true, id: dup.id }, { headers: cors });

    const exp = await db.routeExperience.create({
      data: { routeId: id, routeVersionId: versionId, userId: me.id, rideId, fechaRealizacion: fecha, comentario, condiciones, observacion },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: exp.id }, { headers: cors });
  } catch (e) {
    console.error("[routes.experience]", e);
    return NextResponse.json({ error: "No pudimos registrar la experiencia." }, { status: 500, headers: cors });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.experience.del", me.id, 30, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  const expId = new URL(req.url).searchParams.get("experienceId") ?? "";
  try {
    const exp = await db.routeExperience.findFirst({ where: { id: expId, routeId: id, removedAt: null }, select: { id: true, userId: true } });
    if (!exp) return NextResponse.json({ error: "Experiencia no encontrada." }, { status: 404, headers: cors });
    if (exp.userId !== me.id) return NextResponse.json({ error: "Solo puedes borrar tus experiencias." }, { status: 403, headers: cors });
    await db.routeExperience.update({ where: { id: exp.id }, data: { removedAt: new Date() } });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[routes.experience.DELETE]", e);
    return NextResponse.json({ error: "No pudimos borrar la experiencia." }, { status: 500, headers: cors });
  }
}
