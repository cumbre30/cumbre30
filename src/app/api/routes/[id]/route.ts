export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

// ============================================================
// Rutas y Comunidad — fase A: detalle, edición y baja por id.
// Solo el propietario edita o borra (404 si no es suyo: no se
// filtra la existencia). La edición de geometría o metadatos crea
// una RouteVersion nueva (v = máxima + 1): los rides y experiencias
// antiguos siguen anclados a la versión que recorrieron (v2.1 §2.2).
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";
import type { Prisma } from "@prisma/client";
import {
  type Punto, aprox3, bboxOf, centerOf, cellsOfRoute, distKm, polylineEncode,
} from "@/lib/routeGeo";

/** Normaliza a InputJsonValue (los payload del cliente son unknown). */
function jsonInput(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

const ATTRS_VALIDOS = new Set([
  "escenica", "familiar", "recreativa", "desafiante",
  "principiantes", "miradores", "descanso",
]);

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

async function propia(id: string, meId: string) {
  return db.route.findFirst({
    where: { id, ownerId: meId, removedAt: null },
    include: { versions: { orderBy: { v: "desc" }, take: 1 } },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const { id } = await params;
  const ruta = await db.route.findFirst({
    where: { id, removedAt: null },
    include: {
      pois: { orderBy: { orden: "asc" } },
      versions: { orderBy: { v: "asc" }, select: { id: true, v: true, publishedAt: true } },
    },
  });
  if (!ruta) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
  if (ruta.ownerId !== me.id && ruta.status !== "publicado") {
    // Oculta/retirada: solo el propietario la ve.
    return NextResponse.json({ error: "Ruta no disponible." }, { status: 404, headers: cors });
  }
  return NextResponse.json({ route: ruta }, { headers: cors });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  // 30 ediciones/min por usuario: el outbox reintenta en ráfaga.
  const limited = guard(req, "routes.patch", me.id, 30, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const actual = await propia(id, me.id);
    if (!actual) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });

    const b = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof b.nombre === "string" && b.nombre.trim()) data.nombre = b.nombre.trim().slice(0, 80);
    if (typeof b.descripcion === "string") data.descripcion = b.descripcion.trim().slice(0, 2000) || null;
    if (typeof b.modalidad === "string" && ["urbana", "montana", "mixta"].includes(b.modalidad)) {
      data.modalidad = b.modalidad;
    }
    if (Number.isInteger(b.dificultadFisica) && (b.dificultadFisica as number) >= 1 && (b.dificultadFisica as number) <= 5) {
      data.dificultadFisica = b.dificultadFisica;
      data.dificultadOrigen = "creador"; // ajuste del creador: nunca se sobrescribe
    }
    if (Number.isInteger(b.dificultadTecnica) && (b.dificultadTecnica as number) >= 1 && (b.dificultadTecnica as number) <= 5) {
      data.dificultadTecnica = b.dificultadTecnica;
      data.dificultadOrigen = "creador";
    }
    if (Array.isArray(b.attrs)) {
      if (b.attrs.length > 3) return NextResponse.json({ error: "Máximo 3 atributos recreativos." }, { status: 400, headers: cors });
      for (const a of b.attrs) {
        if (typeof a !== "string" || !ATTRS_VALIDOS.has(a)) {
          return NextResponse.json({ error: "Atributo recreativo inválido." }, { status: 400, headers: cors });
        }
      }
      data.attrs = b.attrs.map(String);
    }
    if (b.ultimaRevisionAt === true) {
      // Revisión de vigencia por el creador (v2.1 §7.4): actualiza la
      // fecha y limpia el estado; los reportes jamás mutan geometría.
      data.ultimaRevisionAt = new Date();
      data.estadoVigencia = "vigente";
    }

    // Geometría protegida nueva → versión nueva con snapshot.
    let nuevaPolyline: string | null = null;
    if (Array.isArray(b.coords)) {
      const crudo = b.coords as unknown[];
      if (crudo.length < 2 || crudo.length > 5000) {
        return NextResponse.json({ error: "La geometría necesita entre 2 y 5000 puntos." }, { status: 400, headers: cors });
      }
      const coords: Punto[] = [];
      for (const c of crudo) {
        const p = (c ?? {}) as Record<string, unknown>;
        const lat = typeof p.lat === "number" ? p.lat : NaN;
        const lon = typeof p.lon === "number" ? p.lon : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          return NextResponse.json({ error: "Coordenada inválida." }, { status: 400, headers: cors });
        }
        coords.push({ lat, lon });
      }
      const bbox = bboxOf(coords);
      const centro = centerOf(bbox);
      const celdas = cellsOfRoute(coords);
      nuevaPolyline = polylineEncode(coords);
      data.polyline = nuevaPolyline;
      data.minLat = bbox.minLat;
      data.maxLat = bbox.maxLat;
      data.minLon = bbox.minLon;
      data.maxLon = bbox.maxLon;
      data.cells = celdas.cells;
      data.centerLat = centro.lat;
      data.centerLon = centro.lon;
      data.distKm = distKm(coords);
      data.inicioAproxLat = aprox3(coords[0].lat);
      data.inicioAproxLon = aprox3(coords[0].lon);
      data.finAproxLat = aprox3(coords[coords.length - 1].lat);
      data.finAproxLon = aprox3(coords[coords.length - 1].lon);
      if (b.proteccion && typeof b.proteccion === "object") data.proteccion = b.proteccion;
    }

    // Elevación opcional (v2.1 §5.1): si no viene, se conservan los
    // valores vigentes — nunca se inventa 0.
    const e = (b.ele && typeof b.ele === "object" ? b.ele : null) as Record<string, unknown> | null;
    if (e) {
      const num = (v: unknown, min: number, max: number): number | null =>
        typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
      const gainM = num(e.gainM, -1000, 8000);
      const lossM = num(e.lossM, -1000, 8000);
      const minEle = num(e.minEle, -500, 9000);
      const maxEle = num(e.maxEle, -500, 9000);
      if (gainM !== null) data.gainM = gainM;
      if (lossM !== null) data.lossM = lossM;
      if (minEle !== null) data.minEle = minEle;
      if (maxEle !== null) data.maxEle = maxEle;
      if (typeof b.eleFuente === "string" && ["gpx", "servicio"].includes(b.eleFuente)) {
        data.eleFuente = b.eleFuente;
      }
    }

    const actualizada = await db.route.update({ where: { id: actual.id }, data });

    // Snapshot de versión solo si cambió la geometría (nuevaPolyline
    // no null): los rides y experiencias siguen anclados a su versión.
    if (nuevaPolyline !== null) {
      const siguienteV = (actual.versions[0]?.v ?? 0) + 1;
      await db.routeVersion.create({
        data: {
          routeId: actual.id,
          v: siguienteV,
          geometrySnapshot: nuevaPolyline,
          metaSnapshot: jsonInput({
            nombre: (data.nombre as string) ?? actual.nombre,
            modalidad: (data.modalidad as string) ?? actual.modalidad,
            attrs: (data.attrs as string[]) ?? actual.attrs,
            proteccion: (data.proteccion ?? actual.proteccion) as Record<string, unknown>,
          }),
          eleSnapshot: {
            gainM: (data.gainM as number | null) ?? actual.gainM,
            lossM: (data.lossM as number | null) ?? actual.lossM,
            minEle: (data.minEle as number | null) ?? actual.minEle,
            maxEle: (data.maxEle as number | null) ?? actual.maxEle,
          },
        },
      });
      return NextResponse.json({ ok: true, version: siguienteV }, { headers: cors });
    }
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[routes.PATCH]", e);
    return NextResponse.json({ error: "No pudimos actualizar la ruta." }, { status: 500, headers: cors });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.delete", me.id, 30, 60_000, cors);
  if (limited) return limited;
  const { id } = await params;
  try {
    const actual = await propia(id, me.id);
    if (!actual) return NextResponse.json({ error: "Ruta no encontrada." }, { status: 404, headers: cors });
    // Soft-delete (v2.1 §2.2): removedAt + primera convención general
    // del proyecto; la purga diferida (fase E) decide el borrado físico.
    await db.route.update({
      where: { id: actual.id },
      data: { removedAt: new Date(), status: "retirada" },
    });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("[routes.DELETE]", e);
    return NextResponse.json({ error: "No pudimos borrar la ruta." }, { status: 500, headers: cors });
  }
}
