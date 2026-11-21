export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Comentarios de ruta (fase E): texto ≤ 1000, soft-delete propio
// (removedAt), listado público con username. Jamás escriben en Route.
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
  const limited = guard(req, "routes.comment", me.id, 20, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const b = (await req.json()) as { body?: unknown };
    const body = typeof b.body === "string" ? b.body.trim().slice(0, 1000) : "";
    if (!body) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400, headers: cors });
    const ruta = await db.route.findFirst({ where: { id, removedAt: null, status: "publicado" }, select: { id: true } });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    const c = await db.routeComment.create({
      data: { routeId: id, userId: me.id, body },
      select: { id: true, body: true, createdAt: true, user: { select: { username: true } } },
    });
    return NextResponse.json({ ok: true, comment: { ...c, username: c.user.username, user: undefined } }, { headers: cors });
  } catch (e) {
    console.error("[routes.comment]", e);
    return NextResponse.json({ error: "No pudimos guardar el comentario." }, { status: 500, headers: cors });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.comment.del", me.id, 30, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId") ?? "";
  try {
    const c = await db.routeComment.findFirst({
      where: { id: commentId, routeId: id, removedAt: null },
      select: { id: true, userId: true },
    });
    if (!c) return NextResponse.json({ error: "Comentario no encontrado." }, { status: 404, headers: cors });
    // Soft-delete solo del autor (el moderador usa /api/moderation).
    if (c.userId !== me.id) return NextResponse.json({ error: "Solo puedes borrar tus comentarios." }, { status: 403, headers: cors });
    await db.routeComment.update({ where: { id: c.id }, data: { removedAt: new Date() } });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[routes.comment.DELETE]", e);
    return NextResponse.json({ error: "No pudimos borrar el comentario." }, { status: 500, headers: cors });
  }
}
