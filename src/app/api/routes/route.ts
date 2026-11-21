export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.

// ============================================================
// Rutas y Comunidad — fase A (arquitectura v2.1): CRUD básico con
// sesión. El dispositivo envía SOLO la geometría protegida (v2.1
// §3: el original jamás sale del teléfono); el servidor deriva
// bbox/celdas/distancia al escribir (routeGeo) y guarda la
// RouteVersion v1 como base del historial. Elevación: si no viene,
// queda null — JAMÁS 0 ficticio (v2.1 §5.1).
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

/** Atributos recreativos orientativos (enumerado cerrado, v2.1 §5.3). */
const ATTRS_VALIDOS = new Set([
  "escenica", "familiar", "recreativa", "desafiante",
  "principiantes", "miradores", "descanso",
]);

const MODALIDADES = new Set(["urbana", "montana", "mixta"]);

export async function OPTIONS(req: Request) {
  // Preflight del fetch cross-origin desde el APK (sync con Bearer).
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const routes = await db.route.findMany({
    where: { ownerId: me.id, removedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true, nombre: true, descripcion: true, modalidad: true,
      status: true, distKm: true, gainM: true, eleFuente: true,
      dificultadFisica: true, dificultadTecnica: true, dificultadOrigen: true,
      attrs: true, ultimaRevisionAt: true, estadoVigencia: true,
      createdAt: true, updatedAt: true,
      versions: { orderBy: { v: "desc" }, take: 1, select: { id: true, v: true } },
    },
  });
  return NextResponse.json({ routes }, { headers: cors });
}

type PoiEntrada = { lat: number; lon: number; tipo: string; nombre: string; nota?: string };

/** Valida y normaliza el payload de creación. Devuelve el error o null. */
function validarPayload(
  b: Record<string, unknown>,
): { error: string } | { coords: Punto[]; attrs: string[]; modalidad: string; nombre: string; descripcion: string | null; pois: PoiEntrada[] } {
  const nombre = typeof b.nombre === "string" ? b.nombre.trim().slice(0, 80) : "";
  if (!nombre) return { error: "La ruta necesita un nombre." };
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.trim().slice(0, 2000) : null;

  const modalidad = typeof b.modalidad === "string" && MODALIDADES.has(b.modalidad) ? b.modalidad : "urbana";

  const crudo = Array.isArray(b.coords) ? (b.coords as unknown[]) : [];
  if (crudo.length < 2 || crudo.length > 5000) {
    return { error: "La geometría protegida necesita entre 2 y 5000 puntos." };
  }
  const coords: Punto[] = [];
  for (const c of crudo) {
    const p = c as Record<string, unknown>;
    const lat = typeof p.lat === "number" ? p.lat : NaN;
    const lon = typeof p.lon === "number" ? p.lon : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { error: "Coordenada inválida en la geometría." };
    }
    coords.push({ lat, lon });
  }

  const attrsCrudos = Array.isArray(b.attrs) ? (b.attrs as unknown[]) : [];
  if (attrsCrudos.length > 3) return { error: "Máximo 3 atributos recreativos." };
  const attrs: string[] = [];
  for (const a of attrsCrudos) {
    if (typeof a !== "string" || !ATTRS_VALIDOS.has(a)) return { error: "Atributo recreativo inválido." };
    attrs.push(a);
  }

  const poisCrudos = Array.isArray(b.pois) ? (b.pois as unknown[]) : [];
  if (poisCrudos.length > 20) return { error: "Máximo 20 puntos de interés." };
  const pois: PoiEntrada[] = [];
  for (const q of poisCrudos) {
    const p = (q ?? {}) as Record<string, unknown>;
    const lat = typeof p.lat === "number" ? p.lat : NaN;
    const lon = typeof p.lon === "number" ? p.lon : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: "POI con coordenada inválida." };
    pois.push({
      lat,
      lon,
      tipo: typeof p.tipo === "string" ? p.tipo.slice(0, 24) : "otro",
      nombre: typeof p.nombre === "string" ? p.nombre.trim().slice(0, 60) : "POI",
      nota: typeof p.nota === "string" ? p.nota.trim().slice(0, 500) : undefined,
    });
  }

  return { coords, attrs, modalidad, nombre, descripcion, pois };
}

/** Elevación opcional del payload: si no hay datos completos queda
 *  null (v2.1 §5.1: prohibido el 0 ficticio como desnivel). */
function eleDePayload(b: Record<string, unknown>): { gainM: number | null; lossM: number | null; minEle: number | null; maxEle: number | null; eleFuente: string | null } {
  const e = (b.ele && typeof b.ele === "object" ? b.ele : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
  const gainM = num(e.gainM, -1000, 8000);
  const lossM = num(e.lossM, -1000, 8000);
  const minEle = num(e.minEle, -500, 9000);
  const maxEle = num(e.maxEle, -500, 9000);
  const fuente = typeof b.eleFuente === "string" && ["gpx", "servicio"].includes(b.eleFuente)
    ? b.eleFuente
    : gainM === null && lossM === null && minEle === null && maxEle === null
      ? null
      : "gpx";
  return { gainM, lossM, minEle, maxEle, eleFuente: fuente };
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  // 20 publicaciones/min por usuario: el outbox puede reintentar en
  // ráfaga tras reconectar; un humano no publica ni cerca de eso.
  const limited = guard(req, "routes.post", me.id, 20, 60_000, cors);
  if (limited) return limited;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const v = validarPayload(b);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400, headers: cors });

    // Idempotente por clientId: un reintento del outbox tras un corte
    // de red no duplica la ruta (patrón de rides con clientId).
    const clientId = typeof b.clientId === "string" ? b.clientId.slice(0, 64) : null;
    if (clientId) {
      const existing = await db.route.findFirst({
        where: { ownerId: me.id, removedAt: null, AND: [{ versions: { some: { metaSnapshot: { path: ["clientId"], equals: clientId } } } }] },
        select: { id: true, versions: { orderBy: { v: "desc" }, take: 1, select: { id: true, v: true } } },
      });
      if (existing) {
        return NextResponse.json({
          ok: true, id: existing.id, dedup: true,
          versionId: existing.versions[0]?.id ?? null,
          version: existing.versions[0]?.v ?? 1,
        }, { headers: cors });
      }
    }

    const bbox = bboxOf(v.coords);
    const centro = centerOf(bbox);
    const celdas = cellsOfRoute(v.coords);
    const ele = eleDePayload(b);
    const polyline = polylineEncode(v.coords);
    const proteccion = b.proteccion && typeof b.proteccion === "object" ? (b.proteccion as Record<string, unknown>) : null;
    const metaVersion = {
      clientId,
      nombre: v.nombre,
      modalidad: v.modalidad,
      attrs: v.attrs,
      proteccion,
      publicadoDesde: "fase-A",
    };

    const ruta = await db.route.create({
      data: {
        ownerId: me.id,
        nombre: v.nombre,
        descripcion: v.descripcion,
        modalidad: v.modalidad,
        polyline,
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
        minLon: bbox.minLon,
        maxLon: bbox.maxLon,
        cells: celdas.cells,
        centerLat: centro.lat,
        centerLon: centro.lon,
        distKm: distKm(v.coords),
        // Extremos aproximados (~110 m de redondeo): jamás el pin exacto.
        inicioAproxLat: aprox3(v.coords[0].lat),
        inicioAproxLon: aprox3(v.coords[0].lon),
        finAproxLat: aprox3(v.coords[v.coords.length - 1].lat),
        finAproxLon: aprox3(v.coords[v.coords.length - 1].lon),
        proteccion: proteccion ? jsonInput(proteccion) : undefined,
        gainM: ele.gainM,
        lossM: ele.lossM,
        minEle: ele.minEle,
        maxEle: ele.maxEle,
        eleFuente: ele.eleFuente,
        dificultadFisica: Number.isInteger(b.dificultadFisica) && (b.dificultadFisica as number) >= 1 && (b.dificultadFisica as number) <= 5 ? (b.dificultadFisica as number) : 2,
        dificultadTecnica: Number.isInteger(b.dificultadTecnica) && (b.dificultadTecnica as number) >= 1 && (b.dificultadTecnica as number) <= 5 ? (b.dificultadTecnica as number) : 2,
        attrs: v.attrs,
        status: "publicado",
        ultimaRevisionAt: new Date(),
        versions: {
          create: {
            v: 1,
            geometrySnapshot: polyline,
            metaSnapshot: jsonInput(metaVersion),
            eleSnapshot: jsonInput(ele),
          },
        },
        pois: {
          create: v.pois.map((p, i) => ({ orden: i, lat: p.lat, lon: p.lon, tipo: p.tipo, nombre: p.nombre, nota: p.nota ?? null })),
        },
      },
      select: { id: true, versions: { orderBy: { v: "desc" }, take: 1, select: { id: true, v: true } } },
    });
    return NextResponse.json({
      ok: true,
      id: ruta.id,
      versionId: ruta.versions[0]?.id ?? null,
      version: ruta.versions[0]?.v ?? 1,
    }, { headers: cors });
  } catch (e) {
    console.error("[routes.POST]", e);
    return NextResponse.json({ error: "No pudimos guardar la ruta." }, { status: 500, headers: cors });
  }
}
