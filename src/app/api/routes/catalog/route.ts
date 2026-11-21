export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web.

// ============================================================
// CATÁLOGO público de rutas (fase D, arquitectura v2.1 §4):
// búsqueda por área que NUNCA decodifica polilíneas — el predicado
// corre sobre columnas calculadas al escribir:
//   · intersección bbox inclusiva en bordes (CT-G4):
//       minLat <= sur AND maxLat >= norte AND minLon <= este AND maxLon >= oeste
//   · ramificación antimeridiana (CT-G6): si oeste > este, la consulta
//     se parte en dos mitades longitudinales (OR).
//   · celdas geohash del viewport (hasSome, índice GIN) — hace que una
//     ruta larga multi-celda que CRUZA el viewport aparezca aunque su
//     centro quede fuera (CT-G2). El bbox solo deja el falso positivo
//     documentado (CT-G5: ruta en U cuyo bbox cruza sin cruzarse),
//     que la respuesta declara en `notaBbox`.
// Paginación por cursor [createdAt, id] estable ante inserciones
// entre páginas (CT-G7). Sesión obligatoria (patrón vigente) y
// orden por fecha de publicación.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";
import { guard } from "@/lib/rateLimit";
import { cellsForViewport } from "@/lib/routeGeo";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

function num(v: string | null): number | null {
  if (v === null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });
  const limited = guard(req, "routes.catalog", me.id, 120, 60_000, cors);
  if (limited) return limited;

  try {
    const p = new URL(req.url).searchParams;
    const n = num(p.get("n"));
    const s = num(p.get("s"));
    const e = num(p.get("e"));
    const o = num(p.get("o"));
    const q = (p.get("q") ?? "").trim().slice(0, 80);
    const modalidad = p.get("modalidad") ?? "";
    const dif = num(p.get("dif"));
    const attrs = (p.get("attrs") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const take = Math.min(Math.max(num(p.get("take")) ?? 20, 1), 30);
    // Cursor de paginación: id único + skip 1 (orden compuesto
    // [createdAt desc, id desc] — estable ante inserciones, CT-G7).
    const cursorId = p.get("cursor");

    if (n === null || s === null || e === null || o === null || s > n) {
      return NextResponse.json({ error: "Viewport inválido (n,s,e,o)." }, { status: 400, headers: cors });
    }

    // Ramificación antimeridiana: viewport que cruza el ±180 (oeste > este)
    // se resuelve como dos mitades con OR (CT-G6); viewport normal usa el
    // predicado inclusivo simple (CT-G4).
    const lonRamificado = o > e;
    const lonCond = lonRamificado
      ? [{ minLon: { lte: e } }, { minLon: { gte: o } }]
      : [{ minLon: { lte: e }, maxLon: { gte: o } }];

    const cells = cellsForViewport(n, s, e, o);

    const routes = await db.route.findMany({
      where: {
        status: "publicado",
        removedAt: null,
        minLat: { lte: n },
        maxLat: { gte: s },
        ...(lonRamificado ? { OR: lonCond } : { ...lonCond[0] }),
        cells: { hasSome: cells },
        ...(q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { descripcion: { contains: q, mode: "insensitive" } }] } : {}),
        ...(modalidad && ["urbana", "montana", "mixta"].includes(modalidad) ? { modalidad } : {}),
        ...(dif !== null && dif >= 1 && dif <= 5 ? { dificultadFisica: { gte: dif } } : {}),
        ...(attrs.length ? { attrs: { hasSome: attrs } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        modalidad: true,
        distKm: true,
        gainM: true,
        eleFuente: true,
        dificultadFisica: true,
        dificultadTecnica: true,
        attrs: true,
        estadoVigencia: true,
        ultimaRevisionAt: true,
        createdAt: true,
        polyline: true,
        inicioAproxLat: true,
        inicioAproxLon: true,
        finAproxLat: true,
        finAproxLon: true,
        centerLat: true,
        centerLon: true,
        coordsPubVer: true,
        owner: { select: { username: true } },
        versions: { orderBy: { v: "desc" }, take: 1, select: { v: true, publishedAt: true } },
      },
    });

    const ultimo = routes[routes.length - 1] ?? null;
    return NextResponse.json(
      {
        routes: routes.map((r) => ({ ...r, version: r.versions[0]?.v ?? 1, creador: r.owner?.username ?? "" })),
        // CT-G5: el bbox puede incluir rutas cuyo bbox cruza el viewport
        // sin que la geometría lo haga (trazado en U). Documentado.
        notaBbox: "La búsqueda es por bbox + celdas: puede incluir rutas cuyo rectángulo cruza el área sin cruzarla realmente.",
        nextCursor: ultimo ? { createdAt: ultimo.createdAt, id: ultimo.id } : null,
      },
      { headers: cors },
    );
  } catch (e) {
    console.error("[routes.catalog]", e);
    return NextResponse.json({ error: "No pudimos listar el catálogo." }, { status: 500, headers: cors });
  }
}
