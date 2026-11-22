// ============================================================
// Ingesta de metadatos para Cultura Ciclista (2026-11-22):
// ENRIQUECE el catálogo editorial propio con proveedores externos.
//   · Open Library  — sin clave (covers.openlibrary.org permite uso
//     con atribución); anio, páginas y portada para LIBROS.
//   · Google Books  — GOOGLE_BOOKS_API_KEY (opcional; sin clave
//     funciona a bajo volumen); año y páginas para LIBROS.
//   · TMDB          — TMDB_API_KEY (requerida para este proveedor);
//     año, duración y país para PELÍCULAS y DOCUMENTALES.
//
// Reglas inquebrantables:
//   1. Las claves viven SOLO en variables de entorno del backend.
//   2. JAMÁS sobreescribe el trabajo editorial: solo completa campos
//      vacíos (anio, pais, extra, portadaUrl). La reseña, el autor,
//      las categorías y el enlace externo de la semilla son sagrados.
//   3. Las portadas se guardan solo de fuentes cuyo uso está
//      permitido (openlibrary); TMDB/Google exigen atribución con
//      condiciones adicionales → no se usan sus imágenes por defecto.
//   4. Un proveedor caído NO detiene la ingesta ni afecta al módulo:
//      el catálogo vive en la base propia (cultura_recursos).
//   5. Restricción por idioma (v4) según el campo `idioma` del
//      recurso (edición/versión de referencia): es → language:spa /
//      langRestrict=es / es-CL · pt → language:por / langRestrict=pt /
//      pt-BR · en → sin restricción (corpus nativo).
//
// Uso (dry-run por defecto):
//   DATABASE_URL=... bun scripts/ingesta-cultura.mjs
//   DATABASE_URL=... bun scripts/ingesta-cultura.mjs --aplicar
//   DATABASE_URL=... TMDB_API_KEY=... GOOGLE_BOOKS_API_KEY=... \
//     bun scripts/ingesta-cultura.mjs --aplicar
// ============================================================
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const APLICAR = process.argv.includes("--aplicar");
const GB_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? "";
const TMDB_KEY = process.env.TMDB_API_KEY ?? "";
const PAUSA_MS = 350; // cortesía con los proveedores (rate limit propio)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sinAnio = (a) => a === null || a === undefined || a === "";
// Restricción de idioma del proveedor según la edición de referencia.
const qIdiomaOL = (idioma) => (idioma === "es" ? " language:spa" : idioma === "pt" ? " language:por" : "");
const langTMDB = (idioma) => (idioma === "es" ? "es-CL" : idioma === "pt" ? "pt-BR" : "en-US");
let cambios = 0;
let fallos = 0;

async function openLibrary(rec) {
  const q = encodeURIComponent(`${rec.titulo} ${rec.autor}${qIdiomaOL(rec.idioma)}`);
  const r = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=3`, {
    headers: { "User-Agent": "Cumbre30/1.21 (catalogo cultura ciclista)" },
  });
  if (!r.ok) throw new Error(`openlibrary HTTP ${r.status}`);
  const d = await r.json();
  const doc = (d.docs ?? [])[0];
  if (!doc) return null;
  return {
    anio: sinAnio(rec.anio) && doc.first_publish_year ? String(doc.first_publish_year) : null,
    extra: rec.extra === null && doc.number_of_pages_median ? `${doc.number_of_pages_median} páginas` : null,
    portadaUrl: rec.portadaUrl === null && doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` // uso permitido con atribución
      : null,
    proveedor: "open_library",
  };
}

async function googleBooks(rec) {
  if (!GB_KEY) return null; // sin clave: se salta (documentado)
  const q = encodeURIComponent(`intitle:${rec.titulo} inauthor:${rec.autor}`);
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&key=${GB_KEY}`);
  if (!r.ok) throw new Error(`google_books HTTP ${r.status}`);
  const d = await r.json();
  const v = (d.items ?? [])[0]?.volumeInfo;
  if (!v) return null;
  const anio = v.publishedDate ? String(v.publishedDate).slice(0, 4) : null;
  return {
    anio: sinAnio(rec.anio) && anio ? anio : null,
    extra: rec.extra === null && v.pageCount ? `${v.pageCount} páginas` : null,
    portadaUrl: null, // política: portadas de Google solo con atribución activa → no por defecto
    proveedor: "google_books",
  };
}

async function tmdb(rec) {
  if (!TMDB_KEY) return null;
  const esSerie = (rec.extra ?? "").toLowerCase().includes("serie");
  const path = esSerie ? "search/tv" : "search/movie";
  const r = await fetch(
    `https://api.themoviedb.org/3/${path}?query=${encodeURIComponent(rec.titulo)}&language=${langTMDB(rec.idioma)}`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } }, // token v4 (read access)
  );
  if (!r.ok) throw new Error(`tmdb HTTP ${r.status}`);
  const d = await r.json();
  const item = (d.results ?? [])[0];
  if (!item) return null;
  const fecha = item.release_date ?? item.first_air_date ?? null;
  const dur = item.runtime ? `${item.runtime} min` : null;
  const paises = (item.origin_country ?? [])[0] ?? null;
  return {
    anio: sinAnio(rec.anio) && fecha ? String(fecha).slice(0, 4) : null,
    extra: rec.extra === null && dur ? dur : null,
    pais: rec.pais === null && paises ? paises : null,
    portadaUrl: null, // política: imágenes TMDB exigen atribución específica → no por defecto
    proveedor: "tmdb",
  };
}

async function main() {
  const recursos = await db.culturaRecurso.findMany({
    where: { publicado: true, proveedor: "editorial" },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Ingesta sobre ${recursos.length} recursos editoriales · modo ${APLICAR ? "APLICAR" : "dry-run"}`);
  if (!TMDB_KEY) console.log("· TMDB_API_KEY ausente: películas/documentales se saltan (módulo no se ve afectado)");
  if (!GB_KEY) console.log("· GOOGLE_BOOKS_API_KEY ausente: solo Open Library enriquece libros");

  for (const rec of recursos) {
    const esLibro = rec.tipo === "libro";
    const proveedores = esLibro ? [openLibrary, googleBooks] : [tmdb];
    for (const fn of proveedores) {
      try {
        const delta = await fn(rec);
        if (!delta) continue;
        const aplicable = Object.fromEntries(
          Object.entries(delta).filter(([k, v]) => v !== null && k !== "proveedor"),
        );
        if (Object.keys(aplicable).length === 0) continue;
        console.log(`  ${rec.titulo} ← ${delta.proveedor}: ${JSON.stringify(aplicable)}`);
        cambios++;
        if (APLICAR) {
          await db.culturaRecurso.update({
            where: { id: rec.id },
            data: { ...aplicable, proveedor: `${rec.proveedor}+${delta.proveedor}` },
          });
        }
      } catch (e) {
        fallos++;
        console.log(`  ${rec.titulo} ← ${fn.name}: ${e.message} (continúa)`);
      }
      await sleep(PAUSA_MS);
    }
  }
  console.log(`\nFin: ${cambios} enriquecimiento(s)${APLICAR ? "" : " (dry-run: nada escrito)"} · ${fallos} fallo(s) tolerado(s)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
