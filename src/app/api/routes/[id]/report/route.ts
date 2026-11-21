export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Reportes tipificados (fase E, v2.1 §7.1-§7.2): motivos cerrados,
// dedupe por [ruta, reportante, motivo] (@@unique), el autor no se
// denuncia a sí mismo, 10/día por usuario, peso del reportante
// calculado en el servidor y ocultamiento automático SOLO para
// cierre/peligro con umbral ponderado ≥ 2.0 y ≥ 2 reportantes
// distintos (lote sospechoso → cola, sin auto-ocultamiento). Todo
// ocultamiento es reversible y queda en ModerationLog con el
// detalle de la decisión. Los reportes NUNCA cambian la geometría.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";
import {
  MOTIVOS_VALIDOS, evaluarAutohide, pesoReportante, vigenciaConReportes,
  type MotivoReporte, type ReporteAbierto,
} from "@/lib/comunidad";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  // 10 reportes/día por usuario (rateLimit.ts, ventana de un día).
  const limited = guard(req, "routes.report", me.id, 10, 86_400_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const b = (await req.json()) as { motivo?: unknown; nota?: unknown };
    const motivo = typeof b.motivo === "string" && MOTIVOS_VALIDOS.includes(b.motivo as MotivoReporte) ? b.motivo as MotivoReporte : null;
    if (!motivo) return NextResponse.json({ error: "Motivo inválido." }, { status: 400, headers: cors });
    const nota = typeof b.nota === "string" ? b.nota.trim().slice(0, 500) || null : null;

    const ruta = await db.route.findFirst({ where: { id, removedAt: null }, select: { id: true, ownerId: true, status: true, ultimaRevisionAt: true } });
    if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    if (ruta.ownerId === me.id) {
      // Patrón vigente en incidents: el autor no se denuncia.
      return NextResponse.json({ error: "No puedes denunciar tu propia ruta." }, { status: 400, headers: cors });
    }

    // Dedupe: única denuncia por usuario y motivo.
    const dup = await db.routeReport.findUnique({
      where: { routeId_reporterId_motivo: { routeId: id, reporterId: me.id, motivo } },
    });
    if (dup) return NextResponse.json({ ok: true, yaReportado: true, estado: dup.estado }, { headers: cors });

    // Peso del reportante en el servidor: veterano 1,5 / regular 1,0 /
    // nueva 0,5; decae 0,25 por denuncia descartada (§7.2).
    const [cuenta, confirmadas, rides, descartadas] = await Promise.all([
      db.user.findUnique({ where: { id: me.id }, select: { createdAt: true } }),
      db.routeReport.count({ where: { reporterId: me.id, estado: "confirmada" } }),
      db.ride.count({ where: { userId: me.id } }),
      db.routeReport.count({ where: { reporterId: me.id, estado: "descartada" } }),
    ]);
    const diasCuenta = cuenta ? Math.floor((Date.now() - cuenta.createdAt.getTime()) / 86_400_000) : 0;
    const peso = pesoReportante({ diasCuenta, contribucionesConfirmadas: confirmadas, rides, descartadas });

    // El reporte se crea PRIMERO: su peso debe entrar en la suma del
    // umbral (§7.2) — evaluar antes dejaría fuera al que llega.
    const reporte = await db.routeReport.create({
      data: { routeId: id, reporterId: me.id, motivo, peso, nota },
    });

    // Lote sospechoso: ≥3 denuncias del mismo motivo en <1 h desde
    // cuentas creadas la misma semana (sin auto-ocultamiento, a cola).
    const abiertosRaw = await db.routeReport.findMany({
      where: { routeId: id, estado: { in: ["abierta", "bajo_revision"] } },
      select: { motivo: true, peso: true, reporterId: true, createdAt: true, reporter: { select: { createdAt: true } } },
    });
    const abiertos: ReporteAbierto[] = abiertosRaw.map((r) => ({
      motivo: r.motivo as MotivoReporte, peso: r.peso, reporterId: r.reporterId,
      clasificacion: "normal",
    }));
    const recientesMismoMotivo = abiertosRaw
      .filter((r) => r.motivo === motivo)
      .map((r) => ({ reporterId: r.reporterId, createdAt: r.createdAt.getTime(), cuentaCreada: r.reporter.createdAt.getTime() }));

    const decision = evaluarAutohide(motivo, abiertos, recientesMismoMotivo);
    if (decision.loteSospechoso) {
      // El LOTE completo queda marcado (los anteriores se guardaron
      // como normal cuando aún no era detectable) y el auto-ocultamiento
      // queda desactivado para el lote: todo a cola de moderación.
      await db.routeReport.updateMany({
        where: { routeId: id, motivo, estado: { in: ["abierta", "bajo_revision"] } },
        data: { clasificacion: "sospechoso" },
      });
    }

    let ocultada = false;
    if (decision.ocultar && ruta.status === "publicado") {
      await db.route.update({ where: { id }, data: { status: "oculta" } });
      ocultada = true;
    }
    // Estado informativo de vigencia: avisos activos con número (§7.4).
    const cierrePeligro = abiertos.filter((r) => r.motivo === "cierre" || r.motivo === "peligro").length + 1;
    await db.route.update({ where: { id }, data: { estadoVigencia: vigenciaConReportes(ruta.ultimaRevisionAt?.toISOString() ?? null, cierrePeligro) } });

    // Trazabilidad: la decisión con pesos y umbral (detalle).
    await db.moderationLog.create({
      data: {
        actorId: me.id,
        accion: decision.ocultar ? "autohide" : "report",
        targetType: "route",
        targetId: id,
        motivo,
        detalle: {
          reporteId: reporte.id, peso, decision,
          reportantesDistintos: decision.reportantes,
          sumaPesos: Math.round(decision.sumaPesos * 100) / 100,
          umbral: decision.umbral,
        },
      },
    });

    return NextResponse.json({ ok: true, estado: "abierta", ocultada, loteSospechoso: decision.loteSospechoso }, { headers: cors });
  } catch (e) {
    console.error("[routes.report]", e);
    return NextResponse.json({ error: "No pudimos registrar el reporte." }, { status: 500, headers: cors });
  }
}
