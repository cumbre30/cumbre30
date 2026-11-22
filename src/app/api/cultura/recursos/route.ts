export const dynamic = "force-dynamic";

// Exportación estática (APK): la API vive en el despliegue web;
// en el bundle estático esta ruta queda pre-renderizada como stub.


import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { corsHeaders, corsPreflight } from "@/lib/apiCors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

/**
 * Catálogo de Cultura Ciclista. Fuente ÚNICA: la tabla propia
 * cultura_recursos (selección editorial persistida). Nunca llama a
 * Google Books/TMDB/Open Library en línea de petición: si los
 * proveedores caen, el módulo sigue funcionando igual.
 *
 * Filtros (opcionales, combinables):
 *   · tipo: libro | pelicula | documental
 *   · cat:  mtb | aventura | historia | ruta | entrenamiento | personas
 *     (el recurso pertenece a la categoría si está en su array)
 *   · q:    búsqueda insensible por título y autor
 *   · destacado=1: solo destacados (fila superior del módulo)
 *
 * La respuesta incluye `favoritos` (ids del usuario con sesión) para
 * que el cliente marque los corazones sin una segunda llamada.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const me = await getSessionUser(req);
  if (!me) return NextResponse.json({ error: "Sin sesión" }, { status: 401, headers: cors });

  const u = new URL(req.url);
  const tipo = u.searchParams.get("tipo");
  const cat = u.searchParams.get("cat");
  const q = (u.searchParams.get("q") ?? "").trim();
  const destacado = u.searchParams.get("destacado");

  const where: Record<string, unknown> = { publicado: true };
  if (tipo && ["libro", "pelicula", "documental"].includes(tipo)) where.tipo = tipo;
  if (cat && ["mtb", "aventura", "historia", "ruta", "entrenamiento", "personas"].includes(cat)) where.categorias = { has: cat };
  if (destacado === "1") where.destacado = true;
  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { autor: { contains: q, mode: "insensitive" } },
    ];
  }

  const recursos = await db.culturaRecurso.findMany({
    where,
    orderBy: [{ destacado: "desc" }, { anio: "asc" }, { titulo: "asc" }],
  });

  const favoritos = await db.culturaFavorito.findMany({
    where: { userId: me.id },
    select: { recursoId: true },
  });

  return NextResponse.json(
    { recursos, favoritos: favoritos.map((f) => f.recursoId), total: recursos.length },
    { headers: cors },
  );
}
