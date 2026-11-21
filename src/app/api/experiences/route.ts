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
import { CONDICIONES_VALIDAS } from "@/lib/comunidad";

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

  // Filtros (propuesta Pro, Grupo B) — todos validados en servidor:
  //   cond=barro,sombra  → condiciones hasSome del enumerado cerrado
  //   desde/hasta=yyyy-mm-dd → rango de fechaRealizacion
  //   amigos=1 → los autores que sigo primero (orden estable por fecha)
  let condiciones: string[] = [];
  let desde: string | null = null;
  let hasta: string | null = null;
  let amigos = false;
  try {
    const sp = new URL(req.url).searchParams;
    const condRaw = (sp.get("cond") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    condiciones = condRaw.filter((c) => CONDICIONES_VALIDAS.includes(c));
    const fechaOk = /^(\d{4}-\d{2}-\d{2})?$/;
    const d1 = sp.get("desde") ?? "";
    const d2 = sp.get("hasta") ?? "";
    if (fechaOk.test(d1) && d1) desde = d1;
    if (fechaOk.test(d2) && d2) hasta = d2;
    amigos = sp.get("amigos") === "1";
  } catch {
    // sin parámetros válidos: feed sin filtros
  }

  const where: {
    removedAt: null;
    route: { status: string };
    condiciones?: { hasSome: string[] };
    fechaRealizacion?: { gte: string; lte?: string };
  } = { removedAt: null, route: { status: "publicado" } };
  if (condiciones.length > 0) where.condiciones = { hasSome: condiciones };
  if (desde || hasta) where.fechaRealizacion = { gte: desde ?? "0000-01-01", ...(hasta ? { lte: hasta } : {}) };

  // Con amigos primero se trae un lote mayor y se reordena en memoria
  // (orden estable: amigos primero, luego createdAt desc).
  const takeBusqueda = amigos ? Math.min(take * 3, 100) : take;

  try {
    const [exps, total, porCiclista] = await Promise.all([
      db.routeExperience.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: takeBusqueda,
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

    let lista = exps;

    if (amigos) {
      const amistades = await db.friendship.findMany({ where: { userId: me.id }, select: { friendId: true } });
      const amigosSet = new Set(amistades.map((a) => a.friendId));
      lista = [...exps].sort((a, b) => {
        const fa = amigosSet.has(a.userId) ? 0 : 1;
        const fb = amigosSet.has(b.userId) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return b.createdAt.getTime() - a.createdAt.getTime();
      }).slice(0, take);
    }

    // Distintivo Pro por autor: emails de los autores → registro de
    // compras (una sola consulta batch por feed).
    const idsAutores = [...new Set(lista.map((e) => e.userId))];
    const autores = await db.user.findMany({
      where: { id: { in: idsAutores } },
      select: { id: true, email: true },
    });
    const emailDe = new Map(autores.map((a) => [a.id, a.email]));
    const pros = await proEmailsServer(autores.map((a) => a.email));

    return NextResponse.json(
      {
        experiencias: lista.map((e) => ({
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
        amigos,
      },
      { headers: cors }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el muro." }, { status: 500, headers: cors });
  }
}
