export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// Muro público de experiencias (2026-11-21): feed real de la
// comunidad para la subsección «Experiencias» del módulo Explorar.
// Solo experiencias vivas (removedAt null) de rutas PUBLICADAS —
// las ocultas por moderación y las retiradas no exponen contenido.
// Lectura CON SESIÓN (política de invitado: la comunidad vive en la
// cuenta); respuesta ligera: sin geometría, con username público,
// hasta 6 fotos (propuesta Pro) y el resumen de la ruta. Cada
// experiencia lleva el distintivo `pro` del autor, derivado del
// REGISTRO de compras (ProDelivery) — nunca de lo que declare el
// cliente.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { proEmailsServer } from "@/lib/proLicenseServer";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  // take acotado (1..50, default 30): el muro es un feed, no un volcado.
  let take = 30;
  try {
    const p = Number(new URL(req.url).searchParams.get("take"));
    if (Number.isFinite(p) && p >= 1) take = Math.min(Math.floor(p), 50);
  } catch {
    // sin parámetro válido: default
  }

  const where = { removedAt: null, route: { status: "publicado" } };

  try {
    const [exps, total, porCiclista] = await Promise.all([
      db.routeExperience.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          fechaRealizacion: true,
          comentario: true,
          observacion: true,
          condiciones: true,
          createdAt: true,
          userId: true,
          user: { select: { username: true } },
          photos: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 6 },
          route: {
            select: {
              id: true,
              nombre: true,
              distKm: true,
              dificultadFisica: true,
              dificultadTecnica: true,
              estadoVigencia: true,
            },
          },
        },
      }),
      db.routeExperience.count({ where }),
      db.routeExperience.groupBy({ by: ["userId"], where }),
    ]);

    // Distintivo Pro por autor: emails de los autores → registro de
    // compras (una sola consulta batch por feed).
    const autores = await db.user.findMany({
      where: { id: { in: exps.map((e) => e.userId) } },
      select: { id: true, email: true },
    });
    const emailDe = new Map(autores.map((a) => [a.id, a.email]));
    const pros = await proEmailsServer(autores.map((a) => a.email));

    return NextResponse.json(
      {
        experiencias: exps.map((e) => ({
          id: e.id,
          fechaRealizacion: e.fechaRealizacion,
          comentario: e.comentario,
          observacion: e.observacion,
          condiciones: e.condiciones,
          createdAt: e.createdAt,
          username: e.user.username,
          pro: pros.has((emailDe.get(e.userId) ?? "").toLowerCase()),
          fotos: e.photos.map((f) => f.url),
          ruta: e.route,
        })),
        total,
        ciclistas: porCiclista.length,
      },
      { headers: cors }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el muro." }, { status: 500, headers: cors });
  }
}
