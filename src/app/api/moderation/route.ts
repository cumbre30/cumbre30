export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Moderación (fase E, v2.1 §7.3): autorizada por rol (User.role =
// moderador | admin). Cola: rutas ocultas automáticamente y lotes
// sospechosos pendientes. Acciones: bajo_revision / confirmada /
// descartada (reportes), restaurar / retirar (rutas) — cada una
// queda en ModerationLog (historial inmutable). Los reportes y el
// ocultamiento NUNCA cambian la geometría.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

async function autorizado(req: Request, cors: HeadersInit): Promise<{ me: { id: string; role: string } } | null | { resp: NextResponse }> {
  const me = await getSessionUser(req);
  if (!me) return { resp: NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors }) };
  const fila = await db.user.findUnique({ where: { id: me.id }, select: { role: true } });
  if (!fila || (fila.role !== "moderador" && fila.role !== "admin")) {
    return { resp: NextResponse.json({ error: "Solo moderadores." }, { status: 403, headers: cors }) };
  }
  return { me: { id: me.id, role: fila.role } };
}

/** Cola de moderación. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const aut = await autorizado(req, cors);
  if (aut && "resp" in aut) return aut.resp;
  const me = aut!.me;
  const limited = guard(req, "moderation.get", me.id, 60, 60_000, cors);
  if (limited) return limited;
  try {
    const ocultas = await db.route.findMany({
      where: { status: "oculta", removedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, nombre: true, ownerId: true, estadoVigencia: true, updatedAt: true,
        reports: { where: { estado: { in: ["abierta", "bajo_revision"] } }, select: { id: true, motivo: true, estado: true, clasificacion: true, peso: true, createdAt: true } },
      },
    });
    const sospechosos = await db.routeReport.findMany({
      where: { clasificacion: "sospechoso", estado: "abierta" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, routeId: true, motivo: true, peso: true, createdAt: true },
    });
    const logs = await db.moderationLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, accion: true, targetType: true, targetId: true, motivo: true, createdAt: true } });
    return NextResponse.json({ ocultas, sospechosos, logs }, { headers: cors });
  } catch (e) {
    console.error("[moderation.GET]", e);
    return NextResponse.json({ error: "No pudimos leer la cola." }, { status: 500, headers: cors });
  }
}

type Accion = "bajo_revision" | "confirmada" | "descartada" | "restaurar" | "retirar";

/** Acción de moderación sobre un reporte o una ruta. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const aut = await autorizado(req, cors);
  if (aut && "resp" in aut) return aut.resp;
  const me = aut!.me;
  const limited = guard(req, "moderation.post", me.id, 40, 60_000, cors);
  if (limited) return limited;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const accion = typeof b.accion === "string" ? b.accion : "";
    const reporteId = typeof b.reporteId === "string" ? b.reporteId : null;
    const rutaId = typeof b.rutaId === "string" ? b.rutaId : null;
    const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 500) || null : null;

    if (["bajo_revision", "confirmada", "descartada"].includes(accion) && reporteId) {
      const rep = await db.routeReport.findUnique({ where: { id: reporteId }, select: { id: true, routeId: true, motivo: true } });
      if (!rep) return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404, headers: cors });
      await db.routeReport.update({ where: { id: rep.id }, data: { estado: accion } });
      // Vigencia informativa: confirmados de cierre/peligro → avisos.
      if (accion === "confirmada" && (rep.motivo === "cierre" || rep.motivo === "peligro")) {
        const ruta = await db.route.findUnique({ where: { id: rep.routeId }, select: { ultimaRevisionAt: true } });
        await db.route.update({ where: { id: rep.routeId }, data: { estadoVigencia: "avisos" } });
        void ruta;
      }
      await db.moderationLog.create({
        data: { actorId: me.id, accion, targetType: "report", targetId: rep.id, motivo: rep.motivo, nota },
      });
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    if ((accion === "restaurar" || accion === "retirar") && rutaId) {
      const ruta = await db.route.findFirst({ where: { id: rutaId, removedAt: null }, select: { id: true, status: true, ultimaRevisionAt: true } });
      if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
      const nuevoStatus = accion === "restaurar" ? "publicado" : "retirada";
      await db.route.update({ where: { id: ruta.id }, data: { status: nuevoStatus } });
      // Vigencia al restaurar: se recalcula según reportes abiertos.
      if (accion === "restaurar") {
        const abiertos = await db.routeReport.count({ where: { routeId: ruta.id, estado: { in: ["abierta", "bajo_revision", "confirmada"] }, motivo: { in: ["cierre", "peligro"] } } });
        await db.route.update({
          where: { id: ruta.id },
          data: { estadoVigencia: abiertos > 0 ? "avisos" : ruta.ultimaRevisionAt ? "vigente" : "sin-revisar" },
        });
      }
      await db.moderationLog.create({
        data: { actorId: me.id, accion, targetType: "route", targetId: ruta.id, nota },
      });
      return NextResponse.json({ ok: true, status: nuevoStatus }, { headers: cors });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400, headers: cors });
  } catch (e) {
    console.error("[moderation.POST]", e);
    return NextResponse.json({ error: "No pudimos aplicar la acción." }, { status: 500, headers: cors });
  }
}
