// ============================================================
// Cultura Ciclista (2026-11-22) contra la base REAL local
// (postgres embebido 5433): catálogo editorial persistido, filtros,
// búsqueda y favoritos por usuario + auditoría i18n del bloque cu.*.
// Ejecutar: DATABASE_URL=postgresql://postgres@127.0.0.1:5433/cumbre30 \
//   bun tests/cultura.test.ts
// ============================================================
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { GET as GET_RECURSOS } from "../src/app/api/cultura/recursos/route";
import { GET as GET_FAVS, POST as POST_FAV, DELETE as DEL_FAV } from "../src/app/api/cultura/favoritos/route";
import { setLang, t } from "../src/lib/i18n";

const dbPrueba = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

let pasos = 0;
function ok(nombre: string, cond: boolean): void {
  pasos++;
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}`);
  if (!cond) process.exitCode = 1;
}
function req(method: string, path: string, token: string | null, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function main(): Promise<void> {
  // ---------- limpiar corridas anteriores ----------
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "cultura-" } } });

  console.log("· catálogo editorial persistido (base propia, no APIs externas)");
  const todos = await dbPrueba.culturaRecurso.findMany({ where: { publicado: true } });
  ok("al menos 50 recursos publicados", todos.length >= 50);
  const tipos = new Set(todos.map((r) => r.tipo));
  ok("los 3 tipos presentes (libro/película/documental)", tipos.has("libro") && tipos.has("pelicula") && tipos.has("documental"));
  const cats = new Set(todos.flatMap((r) => r.categorias));
  ok("las 6 categorías del spec en uso", ["mtb", "aventura", "historia", "ruta", "entrenamiento", "personas"].every((c) => cats.has(c)));
  ok("un mismo recurso pertenece a varias categorías", todos.some((r) => r.categorias.length >= 3));
  ok("todos los enlaces externos son https legítimos", todos.every((r) => r.urlExterna.startsWith("https://")));
  ok("sin duplicados (título+tipo)", new Set(todos.map((r) => `${r.titulo}|${r.tipo}`)).size === todos.length);
  ok("cada recurso tiene reseña editorial propia", todos.every((r) => r.resena.length >= 40));
  ok("hay destacados para la fila superior", todos.filter((r) => r.destacado).length >= 2);
  const conPortada = todos.filter((r) => r.portadaUrl !== null).length;
  ok(`portadas de Open Library enriquecidas por la ingesta (${conPortada} recursos)`, conPortada >= 15);

  // ---------- sesiones de prueba ----------
  const ciclistaA = await dbPrueba.user.create({ data: { email: "cultura-a@test.local", username: "culturaA", passwordHash: "x" } });
  const ciclistaB = await dbPrueba.user.create({ data: { email: "cultura-b@test.local", username: "culturaB", passwordHash: "x" } });
  const tokA = (await dbPrueba.session.create({ data: { userId: ciclistaA.id, token: "tok-cult-a", expiresAt: new Date(Date.now() + 86_400_000) } })).token;
  const tokB = (await dbPrueba.session.create({ data: { userId: ciclistaB.id, token: "tok-cult-b", expiresAt: new Date(Date.now() + 86_400_000) } })).token;

  console.log("· GET /api/cultura/recursos");
  const sinSesion = await GET_RECURSOS(req("GET", "/api/cultura/recursos", null));
  ok("sin sesión responde 401", sinSesion.status === 401);
  const resTodos = await GET_RECURSOS(req("GET", "/api/cultura/recursos", tokA));
  const dTodos = (await json(resTodos)) as { recursos: Array<{ id: string; tipo: string; categorias: string[]; titulo: string; autor: string; destacado: boolean }>; favoritos: string[]; total: number };
  ok("catálogo completo con sesión", resTodos.status === 200 && dTodos.total >= 50);
  ok("incluye el arreglo de favoritos del usuario (vacío al inicio)", Array.isArray(dTodos.favoritos) && dTodos.favoritos.length === 0);

  const resLibros = await GET_RECURSOS(req("GET", "/api/cultura/recursos?tipo=libro", tokA));
  const dLibros = (await json(resLibros)) as { recursos: Array<{ tipo: string }>; total: number };
  ok("filtro por tipo entrega solo libros", dLibros.total === dLibros.recursos.length && dLibros.recursos.every((r) => r.tipo === "libro") && dLibros.total >= 20);

  const resMtb = await GET_RECURSOS(req("GET", "/api/cultura/recursos?cat=mtb", tokA));
  const dMtb = (await json(resMtb)) as { recursos: Array<{ categorias: string[] }>; total: number };
  ok("filtro por categoría (MTB) acierta", dMtb.total >= 5 && dMtb.recursos.every((r) => r.categorias.includes("mtb")));

  const resMtbLibro = await GET_RECURSOS(req("GET", "/api/cultura/recursos?cat=mtb&tipo=libro", tokA));
  const dMtbLibro = (await json(resMtbLibro)) as { recursos: Array<{ tipo: string; categorias: string[] }>; total: number };
  ok("filtros combinados (libros de MTB)", dMtbLibro.recursos.every((r) => r.tipo === "libro" && r.categorias.includes("mtb")));

  const resQ = await GET_RECURSOS(req("GET", `/api/cultura/recursos?q=${encodeURIComponent("krabbé")}`, tokA));
  const dQ = (await json(resQ)) as { recursos: Array<{ titulo: string }> };
  ok("búsqueda por autor insensible a mayúsculas/acentos", dQ.recursos.length === 1 && dQ.recursos[0].titulo === "The Rider");

  const resQ2 = await GET_RECURSOS(req("GET", `/api/cultura/recursos?q=${encodeURIComponent("domestique")}`, tokA));
  const dQ2 = (await json(resQ2)) as { recursos: Array<{ titulo: string }> };
  ok("búsqueda por título", dQ2.recursos.some((r) => r.titulo === "Domestique"));

  const resDest = await GET_RECURSOS(req("GET", "/api/cultura/recursos?destacado=1", tokA));
  const dDest = (await json(resDest)) as { recursos: Array<{ destacado: boolean }> };
  ok("destacados=1 entrega solo destacados", dDest.recursos.length >= 2 && dDest.recursos.every((r) => r.destacado));

  // favorito oculto: publicado=false no aparece nunca
  const oculto = await dbPrueba.culturaRecurso.create({ data: { titulo: "Borrador interno", tipo: "libro", categorias: ["historia"], autor: "Prueba", resena: "Reserva del flujo editorial: borrador no visible.", urlExterna: "https://example.com", publicado: false } });
  const resOculto = await GET_RECURSOS(req("GET", "/api/cultura/recursos", tokA));
  const dOculto = (await json(resOculto)) as { recursos: Array<{ id: string }> };
  ok("los borradores (publicado=false) no se publican", !dOculto.recursos.some((r) => r.id === oculto.id));

  console.log("· favoritos por usuario (persistencia e aislamiento)");
  const blanco = dTodos.recursos.find((r) => r.titulo === "The Rider")!;
  const otro = dTodos.recursos.find((r) => r.titulo === "Breaking Away")!;

  const sinId = await POST_FAV(req("POST", "/api/cultura/favoritos", tokA, {}));
  ok("POST sin recursoId → 400", sinId.status === 400);
  const malId = await POST_FAV(req("POST", "/api/cultura/favoritos", tokA, { recursoId: "no-existe" }));
  ok("POST con recurso inexistente → 404", malId.status === 404);

  const add1 = await POST_FAV(req("POST", "/api/cultura/favoritos", tokA, { recursoId: blanco.id }));
  ok("POST agrega favorito", add1.status === 200);
  const add2 = await POST_FAV(req("POST", "/api/cultura/favoritos", tokA, { recursoId: blanco.id }));
  ok("POST repetido es idempotente (unique por usuario)", add2.status === 200);
  await POST_FAV(req("POST", "/api/cultura/favoritos", tokA, { recursoId: otro.id }));

  const favsA = (await json(await GET_FAVS(req("GET", "/api/cultura/favoritos", tokA)))) as { favoritos: Array<{ id: string; titulo: string; resena: string }> };
  ok("GET favoritos del usuario A devuelve los 2 con datos completos", favsA.favoritos.length === 2 && favsA.favoritos.every((f) => typeof f.titulo === "string" && f.resena.length > 0));

  const favsB = (await json(await GET_FAVS(req("GET", "/api/cultura/favoritos", tokB)))) as { favoritos: string[] };
  ok("aislamiento: B no ve los favoritos de A", favsB.favoritos.length === 0);

  const dConFav = (await json(await GET_RECURSOS(req("GET", "/api/cultura/recursos", tokA)))) as { favoritos: string[] };
  ok("el catálogo marca los ids favoritos del usuario", dConFav.favoritos.length === 2 && dConFav.favoritos.includes(blanco.id));

  const del1 = await DEL_FAV(req("DELETE", `/api/cultura/favoritos?recursoId=${blanco.id}`, tokA));
  ok("DELETE quita el favorito", del1.status === 200);
  const del2 = await DEL_FAV(req("DELETE", `/api/cultura/favoritos?recursoId=${blanco.id}`, tokA));
  ok("DELETE repetido es idempotente", del2.status === 200);
  const favsA2 = (await json(await GET_FAVS(req("GET", "/api/cultura/favoritos", tokA)))) as { favoritos: Array<{ id: string }> };
  ok("quedan 1 favorito en A tras quitar uno", favsA2.favoritos.length === 1);
  const sinSesionFav = await GET_FAVS(req("GET", "/api/cultura/favoritos", null));
  ok("favoritos sin sesión → 401", sinSesionFav.status === 401);

  console.log("· i18n: bloque cu.* completo en es/en/pt y sin huérfanas");
  const VISTA = readFileSync(new URL("../src/components/CulturaView.tsx", import.meta.url), "utf8");
  const I18N = readFileSync(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  const usadas = new Set<string>();
  for (const m of VISTA.matchAll(/"(cu\.[a-zA-Z]+)"/g)) usadas.add(m[1]);
  const declaradas = new Set<string>();
  for (const m of I18N.matchAll(/"(cu\.[a-zA-Z]+)":\s*\[/g)) declaradas.add(m[1]);
  const faltantes = [...usadas].filter((k) => !declaradas.has(k));
  const huerfanas = [...declaradas].filter((k) => !usadas.has(k));
  ok(`todas las claves cu.* usadas por CulturaView están declaradas (${usadas.size} usadas)${faltantes.length ? ` → faltan: ${faltantes.join(", ")}` : ""}`, faltantes.length === 0);
  ok(`sin claves cu.* huérfanas${huerfanas.length ? ` → sobran: ${huerfanas.join(", ")}` : ""}`, huerfanas.length === 0);
  ok("menu.cultura y drawer.culturaHint declarados en 3 idiomas", I18N.includes('"menu.cultura": ["Cultura Ciclista", "Cycling Culture", "Cultura do Ciclismo"]') && I18N.includes('"drawer.culturaHint"'));
  let variantesMal = 0;
  for (const k of declaradas) {
    const m = I18N.match(new RegExp(`"${k.replace(/\./g, "\\.")}":\\s*\\[([^\\]]+)\\]`));
    if (!m || m[1].split(",").length < 3) variantesMal++;
  }
  ok("variantes completas es/en/pt en todas las claves cu.*", variantesMal === 0);
  const MUESTRA = ["cu.heroTitulo", "cu.chipLibros", "cu.fichaConsultar", "cu.sinResultados"];
  let muestrasMal = 0;
  for (const lang of ["es", "en", "pt"] as const) {
    setLang(lang);
    for (const k of MUESTRA) {
      const v = t(k);
      if (v.length < 3 || v === k) muestrasMal++;
    }
  }
  setLang("es");
  ok("t() responde en los 3 idiomas (muestreo)", muestrasMal === 0);

  // ---------- limpiar ----------
  await dbPrueba.user.deleteMany({ where: { email: { startsWith: "cultura-" } } });
  await dbPrueba.culturaRecurso.delete({ where: { id: oculto.id } });

  console.log(`\nCULTURA: ${pasos} comprobaciones OK`);
  await dbPrueba.$disconnect();
}

main().catch(async (e) => { console.error(e); await dbPrueba.$disconnect(); process.exit(1); });
